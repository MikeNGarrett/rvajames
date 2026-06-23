'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminEmail } from '@/lib/admin/auth';
import { createServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/types';

type LocationStatusInsert = Tables<'location_status'> extends infer T
  ? { [K in keyof T]?: T[K] }
  : never;

/**
 * Parses the FormData from the closure form into a DB insert/update shape.
 * Validates required fields — throws FormError on failure.
 */
function parseClosureForm(data: FormData): {
  location_id: string;
  kind: 'open' | 'restricted' | 'closed' | 'closed_indefinite';
  affects: string | null;
  reason: string;
  source: string;
  source_url: string | null;
  effective_from: string;
  effective_to: string | null;
  next_review_at: string | null;
} {
  const location_id = data.get('location_id') as string;
  const kind = data.get('kind') as string;
  const reason  = (data.get('reason') as string).trim();
  const source  = (data.get('source') as string).trim();

  if (!location_id) throw new Error('Location is required');
  if (!kind)        throw new Error('Kind is required');
  if (!reason)      throw new Error('Reason is required');
  if (!source)      throw new Error('Source is required');

  const affects      = (data.get('affects') as string)?.trim() || null;
  const source_url   = (data.get('source_url') as string)?.trim() || null;
  const effective_from_raw = (data.get('effective_from') as string)?.trim();
  const effective_to_raw   = (data.get('effective_to') as string)?.trim();
  const next_review_raw    = (data.get('next_review_at') as string)?.trim();

  const effective_from = effective_from_raw
    ? new Date(effective_from_raw).toISOString()
    : new Date().toISOString();
  const effective_to     = effective_to_raw   ? new Date(effective_to_raw).toISOString()   : null;
  const next_review_at   = next_review_raw    ? new Date(next_review_raw).toISOString()    : null;

  return {
    location_id,
    kind: kind as 'open' | 'restricted' | 'closed' | 'closed_indefinite',
    affects,
    reason,
    source,
    source_url,
    effective_from,
    effective_to,
    next_review_at,
  };
}

/** Create a new active closure (manual admin entry). */
export async function createClosure(data: FormData) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');
  const fields   = parseClosureForm(data);

  const { error } = await supabase.from('location_status').insert({
    ...fields,
    state:      'active',
    created_by: 'admin',
  });

  if (error) throw new Error(`Failed to create closure: ${error.message}`);

  revalidatePath('/admin/closures');
  revalidatePath('/');
  redirect('/admin/closures');
}

/** Update an existing closure. */
export async function updateClosure(id: string, data: FormData) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');
  const fields   = parseClosureForm(data);

  const { error } = await supabase
    .from('location_status')
    .update(fields as LocationStatusInsert)
    .eq('id', id);

  if (error) throw new Error(`Failed to update closure: ${error.message}`);

  revalidatePath('/admin/closures');
  revalidatePath('/');
  redirect('/admin/closures');
}

/** Set a closure's state to 'expired'. */
export async function expireClosure(id: string) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');

  const { error } = await supabase
    .from('location_status')
    .update({ state: 'expired', effective_to: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to expire closure: ${error.message}`);

  revalidatePath('/admin/closures');
  revalidatePath('/');
}

/** Duplicate a closure as a new active row (same fields, new id + created_at). */
export async function duplicateClosure(id: string) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');

  const { data: original, error: fetchError } = await supabase
    .from('location_status')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !original) throw new Error('Closure not found');

  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = original;

  const { error } = await supabase.from('location_status').insert({
    ...rest,
    state:        'active',
    effective_from: new Date().toISOString(),
    effective_to:   null,
    created_by:     'admin',
  });

  if (error) throw new Error(`Failed to duplicate closure: ${error.message}`);

  revalidatePath('/admin/closures');
  revalidatePath('/');
}

/** Approve a draft closure (promote to active with optional kind override). */
export async function approveDraft(id: string, data: FormData) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');

  const kind = (data.get('kind') as string) || undefined;
  const affects = (data.get('affects') as string)?.trim() || undefined;
  const effective_to_raw = (data.get('effective_to') as string)?.trim();
  const effective_to = effective_to_raw ? new Date(effective_to_raw).toISOString() : undefined;

  type ApproveUpdate = {
    state: 'active';
    kind?: 'open' | 'restricted' | 'closed' | 'closed_indefinite';
    affects?: string;
    effective_to?: string;
  };
  const update: ApproveUpdate = { state: 'active' };
  if (kind)         update.kind         = kind as ApproveUpdate['kind'];
  if (affects)      update.affects      = affects;
  if (effective_to) update.effective_to = effective_to;

  const { error } = await supabase
    .from('location_status')
    .update(update)
    .eq('id', id);

  if (error) throw new Error(`Failed to approve draft: ${error.message}`);

  revalidatePath('/admin/closures');
  revalidatePath('/');
}

/**
 * Undo an expire — restore a closure to active.
 *
 * Only valid within a 60-second freshness window after the closure was expired.
 * Beyond that, the admin should re-create the closure to avoid accidentally
 * un-expiring something that was intentionally let lapse.
 *
 * Sub-goal 55.
 */
export async function unexpireClosure(id: string) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');

  const { data: row, error: fetchError } = await supabase
    .from('location_status')
    .select('state, effective_to')
    .eq('id', id)
    .single();

  if (fetchError || !row) throw new Error('Closure not found');
  if (row.state !== 'expired') throw new Error('Closure is not in expired state');

  // Enforce the 60-second freshness window against the effective_to timestamp
  // (set to now() by expireClosure).
  const expiredAt = row.effective_to ? new Date(row.effective_to).getTime() : 0;
  const ageSeconds = (Date.now() - expiredAt) / 1000;
  if (ageSeconds > 60) {
    throw new Error(
      'Undo window has closed (>60 s since expire). Re-create the closure if needed.',
    );
  }

  const { error } = await supabase
    .from('location_status')
    .update({ state: 'active', effective_to: null })
    .eq('id', id);

  if (error) throw new Error(`Failed to unexpire closure: ${error.message}`);

  revalidatePath('/admin/closures');
  revalidatePath('/');
}

/** Discard a draft (hard delete — drafts are not meaningful audit trail). */
export async function discardDraft(id: string) {
  await requireAdminEmail();
  const supabase = await createServerClient('service');

  const { error } = await supabase
    .from('location_status')
    .delete()
    .eq('id', id)
    .eq('state', 'draft');

  if (error) throw new Error(`Failed to discard draft: ${error.message}`);

  revalidatePath('/admin/closures');
}

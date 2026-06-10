import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin/auth';
import { createServerClient } from '@/lib/supabase/server';
import { ClosureForm } from '@/components/admin/ClosureForm';
import { ExpireButton } from '../ExpireButton';
import {
  updateClosure,
  approveDraft,
  discardDraft,
} from '../actions';

interface Props {
  params: Promise<{ id: string }>;
}

function KindLabel(kind: string): string {
  const map: Record<string, string> = {
    open: 'Open',
    restricted: 'Restricted',
    closed: 'Closed',
    closed_indefinite: 'Closed indefinitely',
  };
  return map[kind] ?? kind;
}

export default async function EditClosurePage({ params }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const supabase = await createServerClient('service');

  // Fetch the closure row and access-point locations in parallel
  const [{ data: row }, { data: locationRows }] = await Promise.all([
    supabase.from('location_status').select('*, locations(name, slug)').eq('id', id).single(),
    supabase
      .from('locations')
      .select('id, name, slug')
      .eq('kind', 'access_point')
      .order('name'),
  ]);

  if (!row) notFound();

  const locations = (locationRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
  }));

  const isDraft = row.state === 'draft';
  const isActive = row.state === 'active';

  // Bind server actions to this row's id
  const saveAction = updateClosure.bind(null, id);
  const approveAction = isDraft ? approveDraft.bind(null, id) : null;
  const discardAction = isDraft ? discardDraft.bind(null, id) : null;

  const locationName =
    (row.locations as { name: string; slug: string } | null)?.name ?? 'Unknown location';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
        <Link href="/admin/closures" className="hover:text-text underline">
          Closures
        </Link>
        <span aria-hidden="true" className="mx-2">›</span>
        <span className="text-text font-medium">
          {locationName} — {KindLabel(row.kind)}
        </span>
      </nav>

      {/* Heading + state badge */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-text">Edit closure</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {locationName} · Created {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* State pill */}
        <span
          className={[
            'inline-block rounded-full px-3 py-1 text-xs font-semibold',
            isDraft
              ? 'bg-status-caution-subtle text-status-caution-fg'
              : isActive
              ? 'bg-status-safe-subtle text-status-safe-fg'
              : 'bg-surface text-text-muted',
          ].join(' ')}
        >
          {row.state}
        </span>
      </div>

      {/* Draft notice */}
      {isDraft && (
        <div className="rounded-md bg-status-caution-subtle border border-status-caution/40 px-4 py-3 text-sm text-status-caution-fg">
          This is a <strong>draft</strong> — it is not visible to users. Review the fields below,
          then use <strong>Approve &amp; publish</strong> to make it live.
        </div>
      )}

      {/* Card */}
      <div className="rounded-lg border border-border bg-surface-raised p-6">
        <ClosureForm
          locations={locations}
          defaultValues={{
            location_id: row.location_id,
            kind: row.kind,
            affects: row.affects,
            reason: row.reason,
            source: row.source,
            source_url: row.source_url,
            effective_from: row.effective_from,
            effective_to: row.effective_to,
            next_review_at: row.next_review_at,
          }}
          saveAction={saveAction}
          saveLabel={isDraft ? 'Save draft' : 'Update closure'}
          approveDraftAction={approveAction}
          discardDraftAction={discardAction}
        />
      </div>

      {/* Danger zone for active closures */}
      {isActive && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger-subtle p-4">
          <h3 className="text-sm font-semibold text-status-danger mb-2">Danger zone</h3>
          <ExpireButton id={id} locationName={locationName} variant="full" />
          <p className="mt-2 text-xs text-text-muted">
            Sets effective_to to now and changes state to &ldquo;expired&rdquo;. The row is kept for
            audit history but will no longer affect location status.
          </p>
        </div>
      )}
    </div>
  );
}

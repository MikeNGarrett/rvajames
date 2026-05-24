import { createServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/types';

export type LocationStatus = Tables<'location_status'>;
export type LocationStatusKind = LocationStatus['kind'];
export type LocationStatusState = LocationStatus['state'];

/**
 * Returns all active location_status rows that are in-effect on `date`.
 * A row is in-effect when:
 *   - state = 'active'
 *   - effective_from <= date
 *   - effective_to IS NULL (indefinite) OR effective_to > date
 */
export async function getActiveStatuses(
  date: Date,
): Promise<LocationStatus[]> {
  const supabase = await createServerClient('anon');
  const iso = date.toISOString();

  const { data, error } = await supabase
    .from('location_status')
    .select('*')
    .eq('state', 'active')
    .lte('effective_from', iso)
    .or(`effective_to.is.null,effective_to.gt.${iso}`);

  if (error) {
    console.error('[getActiveStatuses] query error:', error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Returns the most-severe active status for a single location on `date`.
 * Severity order: closed_indefinite > closed > restricted > open
 */
export async function getLocationStatus(
  locationId: string,
  date: Date,
): Promise<LocationStatus | null> {
  const supabase = await createServerClient('anon');
  const iso = date.toISOString();

  const { data, error } = await supabase
    .from('location_status')
    .select('*')
    .eq('location_id', locationId)
    .eq('state', 'active')
    .lte('effective_from', iso)
    .or(`effective_to.is.null,effective_to.gt.${iso}`)
    .order('effective_from', { ascending: false });

  if (error) {
    console.error('[getLocationStatus] query error:', error.message);
    return null;
  }

  const rows = data ?? [];
  if (rows.length === 0) return null;

  // Return the most severe active status
  const SEVERITY: Record<LocationStatusKind, number> = {
    'closed_indefinite': 4,
    'closed':            3,
    'restricted':        2,
    'open':              1,
  };

  return rows.reduce((worst, row) =>
    SEVERITY[row.kind] > SEVERITY[worst.kind] ? row : worst,
  );
}

/**
 * Upstream CSO signal for a given river access point.
 *
 * The James River through Richmond flows roughly west-to-east, so an outfall
 * with a smaller longitude than the access point is "upstream" of it.
 * This is the v1 upstream determination model — see docs/cso-emnet-plan.md
 * for the confirmed simplification.
 */

import { createServerClient } from '@/lib/supabase/server';
import { richmondUtcOffset } from '@/lib/utils/date-tz';

export interface UpstreamCsoOutfall {
  name: string;
  csoOccurredAt: string;
  hoursAgo: number;
}

export interface UpstreamCsoSignal {
  count: number;
  mostRecentAt: string | null;
  outfalls: UpstreamCsoOutfall[];
}

/**
 * Advances an ISO date string (YYYY-MM-DD) by one calendar day.
 * Exported for testing.
 */
export function addOneDayISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0];
}

/**
 * Returns CSO advisory rows from outfalls that are upstream of `locationLng`
 * (i.e. outfall.lng < locationLng).
 *
 * Default behavior (no forSelectedDate): returns advisories whose
 * effective_from is within the past `windowHours` hours (now-based window).
 *
 * With forSelectedDate: returns advisories that overlap the selected date
 * (i.e. effective_from < end-of-day AND effective_to > start-of-day).
 * Used for forecast dates so the signal reflects the advisory window rather
 * than a now()-anchored window.
 *
 * Returns { count: 0, mostRecentAt: null, outfalls: [] } when no matches.
 */
export async function getUpstreamCsoForLocation(
  locationLng: number,
  windowHours = 48,
  forSelectedDate?: string,
): Promise<UpstreamCsoSignal> {
  const supabase = await createServerClient('anon');

  // Join advisories to cso_outfalls via the FK. Supabase PostgREST supports
  // embedded filters — select the foreign-table columns via !inner join so
  // rows with no matching outfall are excluded.
  let query = supabase
    .from('advisories')
    .select(
      `
      effective_from,
      cso_outfalls!inner (
        name,
        lng,
        affects_james_mainstem
      )
    `,
    )
    .eq('kind', 'cso_overflow')
    .eq('source', 'emnet_cso');

  if (forSelectedDate) {
    // Date-overlap mode: advisory must cover the selected date.
    // Use ET midnight (not UTC midnight) so the day boundaries align with the
    // ET calendar date that `forSelectedDate` represents. Use separate offsets
    // for start and end so DST fall-back days (Nov 7 → 8) span 25h correctly.
    const nextDay     = addOneDayISO(forSelectedDate);
    const startOffset = richmondUtcOffset(forSelectedDate);
    const endOffset   = richmondUtcOffset(nextDay);
    query = query
      .lt('effective_from', `${nextDay}T${String(endOffset).padStart(2, '0')}:00:00Z`)
      .gt('effective_to',   `${forSelectedDate}T${String(startOffset).padStart(2, '0')}:00:00Z`);
  } else {
    // Default: events whose effective_from is within the past windowHours.
    const windowStart = new Date(Date.now() - windowHours * 3_600_000).toISOString();
    query = query.gt('effective_from', windowStart);
  }

  const { data, error } = await query
    .lt('cso_outfalls.lng', locationLng)
    .eq('cso_outfalls.affects_james_mainstem', true)
    .order('effective_from', { ascending: false });

  if (error || !data?.length) {
    return { count: 0, mostRecentAt: null, outfalls: [] };
  }

  const outfalls: UpstreamCsoOutfall[] = data.map((row) => {
    const hoursAgo = Math.floor(
      (Date.now() - new Date(row.effective_from).getTime()) / 3_600_000,
    );
    // row.cso_outfalls is a single object because it's a !inner embed with FK
    const outfall = row.cso_outfalls as { name: string };
    return {
      name: outfall.name,
      csoOccurredAt: row.effective_from,
      hoursAgo,
    };
  });

  return {
    count: outfalls.length,
    mostRecentAt: outfalls[0]?.csoOccurredAt ?? null,
    outfalls,
  };
}

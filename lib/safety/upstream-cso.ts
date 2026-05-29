/**
 * Upstream CSO signal for a given river access point.
 *
 * The James River through Richmond flows roughly west-to-east, so an outfall
 * with a smaller longitude than the access point is "upstream" of it.
 * This is the v1 upstream determination model — see docs/cso-emnet-plan.md
 * for the confirmed simplification.
 */

import { createServerClient } from '@/lib/supabase/server';

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
 * Returns active CSO advisory rows from outfalls that are upstream of
 * `locationLng` (i.e. outfall.lng < locationLng) within the past
 * `windowHours` hours (default 48).
 *
 * Returns { count: 0, mostRecentAt: null, outfalls: [] } when no matches.
 */
export async function getUpstreamCsoForLocation(
  locationLng: number,
  windowHours = 48,
): Promise<UpstreamCsoSignal> {
  const supabase = await createServerClient('anon');

  const windowStart = new Date(Date.now() - windowHours * 3_600_000).toISOString();

  // Join advisories to cso_outfalls via the FK. Supabase PostgREST supports
  // embedded filters — select the foreign-table columns via !inner join so
  // rows with no matching outfall are excluded.
  const { data, error } = await supabase
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
    .eq('source', 'emnet_cso')
    .gt('effective_from', windowStart)
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

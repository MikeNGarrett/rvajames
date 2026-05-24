/**
 * Fetches or lazily generates the AI metro summary for a given date + age bucket.
 * Calls getOrGenerateMetro which is cache-first against metro_summaries.
 */

import { createServerClient } from '@/lib/supabase/server';
import { getOrGenerateMetro } from '@/lib/ai/get-or-generate';
import { getMetroRiverState } from './river-segment';
import { getActiveStatuses } from './location-status';
import type { AgeBucket } from '@/lib/url-state';
import type { MetroSummary } from '@/lib/ai/prompts/summarize-metro';
import { csoAdvisoryStatus } from '@/lib/safety/rules';

export type { MetroSummary };

export interface MetroSummaryResult {
  summary: MetroSummary | null;
  source: 'cache' | 'generated' | 'stale' | null;
}

export async function getMetroSummary(
  date: string,
  ageBucket: AgeBucket,
): Promise<MetroSummaryResult> {
  const supabase = await createServerClient('anon');

  const now = new Date();

  // Fetch supporting data in parallel
  const [metroState, advisoriesResult, nwsSnap, activeStatuses] = await Promise.all([
    getMetroRiverState(),
    supabase
      .from('advisories')
      .select('headline, severity, location_ids')
      .or(`effective_to.is.null,effective_to.gte.${now.toISOString()}`),
    supabase
      .from('conditions_snapshots')
      .select('air_temp_f')
      .eq('source', 'nws_hourly')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getActiveStatuses(now),
  ]);

  const advisories = advisoriesResult.data ?? [];
  const metroAdvisories = advisories.filter((a) => a.location_ids.length === 0);
  const activeHeadlines = metroAdvisories.map((a) => a.headline);

  const hasHighSeverity = advisories.some(
    (a) => a.severity === 'high' || a.severity === 'extreme',
  );

  const activeCSOAdvisory =
    csoAdvisoryStatus(metroAdvisories.map((a) => ({ kind: a.severity }))) === 'danger' ||
    metroAdvisories.some((a) => (a as { kind?: string }).kind === 'cso_overflow');

  // Build active-closures list for the AI user message.
  // Look up location slugs for any active status rows.
  const closureLocationIds = activeStatuses
    .filter((s) => s.kind === 'closed' || s.kind === 'closed_indefinite' || s.kind === 'restricted')
    .map((s) => s.location_id);

  let activeClosures: Array<{ locationSlug: string; kind: 'open' | 'restricted' | 'closed' | 'closed_indefinite'; reason: string }> = [];

  if (closureLocationIds.length > 0) {
    const { data: locRows } = await supabase
      .from('locations')
      .select('id, slug')
      .in('id', closureLocationIds);

    const slugById = new Map((locRows ?? []).map((l) => [l.id, l.slug]));

    activeClosures = activeStatuses
      .filter((s) => s.kind !== 'open' && slugById.has(s.location_id))
      .map((s) => ({
        locationSlug: slugById.get(s.location_id)!,
        kind:         s.kind,
        reason:       s.reason,
      }));
  }

  const result = await getOrGenerateMetro(
    {
      date,
      ageBucket,
      metroState,
      activeAdvisoryHeadlines: activeHeadlines,
      airTempF:              nwsSnap.data?.air_temp_f ?? null,
      rain48hIn:             0,           // TODO: wire actual precip when NWS provides it
      activeCSOAdvisory,
      hasHighSeverityAdvisory: hasHighSeverity,
      activeClosures,
    },
    hasHighSeverity,
  );

  if (!result) return { summary: null, source: null };
  return { summary: result.summary, source: result.source };
}

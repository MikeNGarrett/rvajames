/**
 * Fetches or lazily generates the AI metro summary for a given date + age bucket.
 * Calls getOrGenerateMetro which is cache-first against metro_summaries.
 */

import { createServerClient } from '@/lib/supabase/server';
import { getOrGenerateMetro } from '@/lib/ai/get-or-generate';
import { getMetroRiverState } from './river-segment';
import type { AgeBucket } from '@/lib/url-state';
import type { MetroSummary } from '@/lib/ai/prompts/summarize-metro';

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

  // Fetch supporting data in parallel
  const [metroState, advisoriesResult, nwsSnap] = await Promise.all([
    getMetroRiverState(),
    supabase
      .from('advisories')
      .select('headline, severity, location_ids')
      .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`),
    supabase
      .from('conditions_snapshots')
      .select('air_temp_f')
      .eq('source', 'nws_hourly')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const advisories = advisoriesResult.data ?? [];
  const activeHeadlines = advisories
    .filter((a) => a.location_ids.length === 0) // metro-wide advisories
    .map((a) => a.headline);

  const hasHighSeverity = advisories.some(
    (a) => a.severity === 'high' || a.severity === 'extreme',
  );

  const result = await getOrGenerateMetro(
    {
      date,
      ageBucket,
      metroState,
      activeAdvisoryHeadlines: activeHeadlines,
      airTempF: nwsSnap.data?.air_temp_f ?? null,
    },
    hasHighSeverity,
  );

  if (!result) return { summary: null, source: null };
  return { summary: result.summary, source: result.source };
}

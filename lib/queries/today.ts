import { createServerClient } from '@/lib/supabase/server';
import type { AgeBucket } from '@/lib/url-state';
import { getMetroRiverState } from './river-segment';
import { combinedLocationStatus, type SafetyStatus } from '@/lib/safety/rules';

export interface DeterministicStatus {
  status: SafetyStatus;
  /** 2–5 word pill label, e.g. "Normal flow" */
  label: string;
  /** Short human-readable reason for the status */
  reason: string;
}

export interface LocationSummary {
  id: string;
  slug: string;
  name: string;
  tags: string[];
  latestGageFt: number | null;
  latestWaterTempF: number | null;
  /** Deterministic rules-engine status — no AI, computed at render time */
  deterministicStatus: DeterministicStatus;
  snapshotAge: number | null;
}

export interface TodayData {
  date: string;
  ageBucket: AgeBucket;
  locations: LocationSummary[];
  activeAdvisories: {
    id: string;
    kind: string;
    severity: string;
    headline: string;
    body: string;
  }[];
  /** True when we have upriver gauge data to base status on */
  hasConditions: boolean;
}

export async function getTodayData(date: string, ageBucket: AgeBucket): Promise<TodayData> {
  const supabase = await createServerClient('anon');

  const [{ data: locations }, { data: advisories }, metroState] = await Promise.all([
    supabase
      .from('locations')
      .select('id, slug, name, tags')
      .eq('kind', 'access_point')
      .order('name'),
    supabase
      .from('advisories')
      .select('id, kind, severity, headline, body')
      .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`)
      .order('severity', { ascending: false }),
    getMetroRiverState(),
  ]);

  if (!locations?.length) {
    return { date, ageBucket, locations: [], activeAdvisories: [], hasConditions: false };
  }

  // Advisories for the rules engine (typed with severity + headline)
  const activeAdvisoryList = (advisories ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    severity: a.severity,
    headline: a.headline,
    body: a.body,
  }));
  const advisoriesForRules = activeAdvisoryList.map((a) => ({
    kind: a.kind,
    severity: a.severity,
    headline: a.headline,
  }));

  // Metro state from the upriver gauge (02037500)
  const upriverGageFt = metroState.upriver.gageFt;
  const upriverWaterTempF = metroState.upriver.waterTempF;
  const upriverFetchedAt = metroState.upriver.fetchedAt;
  const snapshotAge = upriverFetchedAt
    ? Math.round((Date.now() - new Date(upriverFetchedAt).getTime()) / 60_000)
    : null;

  const summarized: LocationSummary[] = locations.map((loc) => {
    const combined = combinedLocationStatus(
      {
        gageFt: upriverGageFt,
        waterTempF: upriverWaterTempF,
        // precip48hIn omitted — we don't have reliable measured precip yet;
        // postRainSwimStatus returns 'safe' when undefined (conservative default)
      },
      advisoriesForRules,
      loc.slug,
    );

    return {
      id: loc.id,
      slug: loc.slug,
      name: loc.name,
      tags: loc.tags,
      latestGageFt: upriverGageFt,
      latestWaterTempF: upriverWaterTempF,
      deterministicStatus: {
        status: combined.status,
        label: combined.label,
        reason: combined.reason,
      },
      snapshotAge,
    };
  });

  return {
    date,
    ageBucket,
    locations: summarized,
    activeAdvisories: activeAdvisoryList,
    hasConditions: upriverGageFt !== null,
  };
}

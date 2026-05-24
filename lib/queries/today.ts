import { createServerClient } from '@/lib/supabase/server';
import type { AgeBucket } from '@/lib/url-state';
import { getMetroRiverState } from './river-segment';
import { getActiveStatusMap } from './location-status';
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

  const now = new Date();
  const [{ data: locations }, { data: advisories }, metroState, statusMap] = await Promise.all([
    supabase
      .from('locations')
      .select('id, slug, name, tags')
      .eq('kind', 'access_point')
      .order('name'),
    supabase
      .from('advisories')
      .select('id, kind, severity, headline, body')
      .or(`effective_to.is.null,effective_to.gte.${now.toISOString()}`)
      .order('severity', { ascending: false }),
    getMetroRiverState(),
    getActiveStatusMap(now),
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
    // Look up any active operational closure / restriction for this location
    const opStatus = statusMap.get(loc.id) ?? null;
    const operationalOverride = opStatus
      ? { kind: opStatus.kind, reason: opStatus.reason, affects: opStatus.affects }
      : null;

    const combined = combinedLocationStatus(
      {
        gageFt: upriverGageFt,
        waterTempF: upriverWaterTempF,
        // precip48hIn omitted — we don't have reliable measured precip yet;
        // postRainSwimStatus returns 'safe' when undefined (conservative default)
      },
      advisoriesForRules,
      loc.slug,
      operationalOverride,
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

  // Sort: operationally closed/restricted locations first (most actionable info
  // at top), then by natural name order within each group.
  const STATUS_SORT_ORDER: Record<SafetyStatus, number> = {
    closed:  0,
    danger:  1,
    caution: 2,
    safe:    3,
  };
  summarized.sort((a, b) => {
    const aOrder = STATUS_SORT_ORDER[a.deterministicStatus.status] ?? 99;
    const bOrder = STATUS_SORT_ORDER[b.deterministicStatus.status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  return {
    date,
    ageBucket,
    locations: summarized,
    activeAdvisories: activeAdvisoryList,
    hasConditions: upriverGageFt !== null,
  };
}

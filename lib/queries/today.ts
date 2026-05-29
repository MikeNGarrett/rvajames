import { createServerClient } from '@/lib/supabase/server';
import type { AgeBucket } from '@/lib/url-state';
import { getMetroRiverState } from './river-segment';
import { getActiveStatusMap } from './location-status';
import { getForecast } from './forecast';
import { getAllLatestWaterQualityReadings } from './water-quality';
import type { NoaaAhpsForecastPoint, NoaaAhpsPayload } from '@/lib/ingest/noaa-ahps';
import { combinedLocationStatus, type SafetyStatus } from '@/lib/safety/rules';
import { formatRichmondDate } from '@/lib/utils/date-tz';
import { isInWindow } from '@/lib/queries/date-range';
import { getUpstreamCsoForLocation, type UpstreamCsoSignal } from '@/lib/safety/upstream-cso';

export interface DeterministicStatus {
  status: SafetyStatus;
  /** 2–5 word pill label, e.g. "Normal flow" */
  label: string;
  /** Short human-readable reason for the status */
  reason: string;
}

/** Water-quality badge data for homepage tiles. null = no badge (off-season or no data). */
export interface WaterQualityBadge {
  /** 'safe' = within VDH thresholds; 'caution' = exceeds single-sample max */
  status: 'safe' | 'caution';
  ecoliCfuPer100ml: number | null;
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
  /**
   * Water-quality badge data. null when:
   *   - No JRA station is mapped to this access point
   *   - No reading within the 14-day recency window exists
   *   - Most recent reading has no bacteria measurement (both null)
   */
  waterQuality: WaterQualityBadge | null;
  /**
   * Upstream CSO signal. null when:
   *   - No active CSO advisories from upstream outfalls within the window
   *   - Location has no lng (defensive — none currently)
   * null is equivalent to count === 0.
   */
  upstreamCso: UpstreamCsoSignal | null;
}

export interface TodayData {
  date: string;
  ageBucket: AgeBucket;
  /** 'observed' for today; 'forecast' for the next 3 days (AHPS data). */
  mode: 'observed' | 'forecast';
  /** null for observed; high/medium/low for forecast days +1/+2/+3. */
  forecastConfidence: 'high' | 'medium' | 'low' | null;
  locations: LocationSummary[];
  activeAdvisories: {
    id: string;
    kind: string;
    severity: string;
    headline: string;
    body: string;
  }[];
  /** True when we have upriver gauge data (observed or forecast) to base status on */
  hasConditions: boolean;
}

/**
 * Thrown by getTodayData when the requested date falls outside the 4-day
 * forecast window (i.e., it is in the past or beyond day +3).
 *
 * Callers (page handlers) should catch this and redirect to today.
 */
export class OutOfWindowError extends Error {
  constructor(public readonly date: string) {
    super(`Date ${date} is outside the 4-day forecast window (today..today+3)`);
    this.name = 'OutOfWindowError';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Number of calendar days between two ISO dates (positive = target is in the future). */
function daysFromToday(todayIso: string, targetIso: string): number {
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = targetIso.split('-').map(Number);
  return Math.round(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
}

function computeConfidence(
  dateIso: string,
  todayIso: string,
): 'high' | 'medium' | 'low' | null {
  const d = daysFromToday(todayIso, dateIso);
  if (d <= 0) return null;
  if (d === 1) return 'high';
  if (d === 2) return 'medium';
  return 'low';
}

/**
 * Picks the AHPS forecast point whose timestamp is closest to noon on
 * `targetDateIso` in Richmond (ET) time.
 *
 * Strategy:
 *   1. Find all points whose Richmond-time date matches targetDateIso.
 *   2. If any exist, pick the one closest to 16:00 UTC (noon EDT / ≈noon ET).
 *   3. If none are on that date (beyond the forecast window), fall back to the
 *      overall point closest to the target's midday — gives a best-effort
 *      reading rather than null.
 */
function pickForecastPoint(
  forecast: NoaaAhpsPayload,
  targetDateIso: string,
): NoaaAhpsForecastPoint | null {
  if (!forecast.forecast.length) return null;

  const [y, m, d] = targetDateIso.split('-').map(Number);
  // Noon EDT = 16:00 UTC (May–November); noon EST = 17:00 UTC (Nov–Mar).
  // 16:00 UTC is a good-enough approximation for the summer boating season.
  const noonApproxMs = Date.UTC(y, m - 1, d, 16, 0, 0);

  const pointsOnDay = forecast.forecast.filter(
    (pt) => formatRichmondDate(new Date(pt.t)) === targetDateIso,
  );

  const pool = pointsOnDay.length ? pointsOnDay : forecast.forecast;
  return pool.reduce((best, pt) =>
    Math.abs(pt.t - noonApproxMs) < Math.abs(best.t - noonApproxMs) ? pt : best,
  );
}

const STATUS_SORT_ORDER: Record<SafetyStatus, number> = {
  closed:  0,
  danger:  1,
  caution: 2,
  safe:    3,
};

/** VDH single-sample recreational water thresholds (mirrors thresholds.json). */
const WQ_ECOLI_MAX  = 235;
const WQ_ENTERO_MAX = 104;
const WQ_RECENCY_DAYS = 14;

/**
 * Computes the homepage water-quality badge state from a latest reading.
 * Returns null when the reading is absent, too old, or has no bacteria values.
 */
function computeWaterQualityBadge(
  reading: Awaited<ReturnType<typeof getAllLatestWaterQualityReadings>>[string] | null,
): WaterQualityBadge | null {
  if (!reading) return null;
  if (reading.daysOld > WQ_RECENCY_DAYS) return null;

  const ecoli  = reading.ecoliCfuPer100ml;
  const entero = reading.enterococciCfuPer100ml;

  // No measurement in this sample — skip badge
  if (ecoli === null && entero === null) return null;

  const ecoliExceeds = ecoli  !== null && ecoli  >= WQ_ECOLI_MAX;
  const entExceeds   = entero !== null && entero >= WQ_ENTERO_MAX;
  const status: 'safe' | 'caution' = (ecoliExceeds || entExceeds) ? 'caution' : 'safe';

  return { status, ecoliCfuPer100ml: ecoli };
}

// ── Observed path (today) ─────────────────────────────────────────────────────

async function getObservedTodayData(
  date: string,
  ageBucket: AgeBucket,
): Promise<TodayData> {
  const supabase = await createServerClient('anon');
  const now = new Date();

  // Kick off water quality fetch in parallel (it uses its own service client)
  const wqPromise = getAllLatestWaterQualityReadings();

  const [{ data: locations }, { data: advisories }, metroState, statusMap, wqReadings] = await Promise.all([
    supabase
      .from('locations')
      .select('id, slug, name, tags, lng')
      .eq('kind', 'access_point')
      .order('name'),
    supabase
      .from('advisories')
      .select('id, kind, severity, headline, body')
      .or(`effective_to.is.null,effective_to.gte.${now.toISOString()}`)
      .order('severity', { ascending: false }),
    getMetroRiverState(),
    getActiveStatusMap(now),
    wqPromise,
  ]);

  if (!locations?.length) {
    return {
      date, ageBucket,
      mode: 'observed', forecastConfidence: null,
      locations: [], activeAdvisories: [], hasConditions: false,
    };
  }

  const activeAdvisoryList = (advisories ?? []).map((a) => ({
    id: a.id, kind: a.kind, severity: a.severity, headline: a.headline, body: a.body,
  }));
  const advisoriesForRules = activeAdvisoryList.map((a) => ({
    kind: a.kind, severity: a.severity, headline: a.headline,
  }));

  const upriverGageFt   = metroState.upriver.gageFt;
  const upriverWaterTempF = metroState.upriver.waterTempF;
  const upriverFetchedAt = metroState.upriver.fetchedAt;
  const snapshotAge = upriverFetchedAt
    ? Math.round((Date.now() - new Date(upriverFetchedAt).getTime()) / 60_000)
    : null;

  // Fetch upstream CSO signals for all locations in parallel
  const upstreamCsoMap = new Map<string, UpstreamCsoSignal | null>();
  await Promise.all(
    locations.map(async (loc) => {
      if (loc.lng == null) {
        upstreamCsoMap.set(loc.id, null);
        return;
      }
      const signal = await getUpstreamCsoForLocation(loc.lng);
      upstreamCsoMap.set(loc.id, signal.count > 0 ? signal : null);
    }),
  );

  const summarized: LocationSummary[] = locations.map((loc) => {
    const opStatus = statusMap.get(loc.id) ?? null;
    const operationalOverride = opStatus
      ? { kind: opStatus.kind, reason: opStatus.reason, affects: opStatus.affects }
      : null;
    const upstreamCso = upstreamCsoMap.get(loc.id) ?? null;

    const combined = combinedLocationStatus(
      { gageFt: upriverGageFt, waterTempF: upriverWaterTempF },
      advisoriesForRules,
      loc.slug,
      operationalOverride,
      upstreamCso,
      loc.tags,
    );

    return {
      id: loc.id, slug: loc.slug, name: loc.name, tags: loc.tags,
      latestGageFt: upriverGageFt,
      latestWaterTempF: upriverWaterTempF,
      deterministicStatus: { status: combined.status, label: combined.label, reason: combined.reason },
      snapshotAge,
      waterQuality: computeWaterQualityBadge(wqReadings[loc.slug] ?? null),
      upstreamCso,
    };
  });

  summarized.sort((a, b) => {
    const diff = (STATUS_SORT_ORDER[a.deterministicStatus.status] ?? 99)
               - (STATUS_SORT_ORDER[b.deterministicStatus.status] ?? 99);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  return {
    date, ageBucket,
    mode: 'observed', forecastConfidence: null,
    locations: summarized,
    activeAdvisories: activeAdvisoryList,
    hasConditions: upriverGageFt !== null,
  };
}

// ── Forecast path (days +1..+3) ───────────────────────────────────────────────

async function getForecastTodayData(
  date: string,
  ageBucket: AgeBucket,
  todayIso: string,
): Promise<TodayData> {
  const supabase = await createServerClient('anon');
  const now = new Date();

  const [{ data: locations }, { data: advisories }, forecast, statusMap] = await Promise.all([
    supabase
      .from('locations')
      .select('id, slug, name, tags, lng')
      .eq('kind', 'access_point')
      .order('name'),
    // Advisories that are currently active; any still-active advisory is relevant
    // for a near-future date too (they rarely resolve within 72 h).
    supabase
      .from('advisories')
      .select('id, kind, severity, headline, body')
      .or(`effective_to.is.null,effective_to.gte.${now.toISOString()}`)
      .order('severity', { ascending: false }),
    getForecast(),
    getActiveStatusMap(now),
  ]);

  const forecastConfidence = computeConfidence(date, todayIso);

  if (!locations?.length) {
    return {
      date, ageBucket,
      mode: 'forecast', forecastConfidence,
      locations: [], activeAdvisories: [], hasConditions: false,
    };
  }

  // Pick the AHPS forecast point closest to noon on the target date
  const forecastPoint = forecast ? pickForecastPoint(forecast, date) : null;
  const upriverGageFt = forecastPoint?.stage_ft ?? null;

  const activeAdvisoryList = (advisories ?? []).map((a) => ({
    id: a.id, kind: a.kind, severity: a.severity, headline: a.headline, body: a.body,
  }));
  const advisoriesForRules = activeAdvisoryList.map((a) => ({
    kind: a.kind, severity: a.severity, headline: a.headline,
  }));

  // Fetch upstream CSO signals for all locations in parallel
  const upstreamCsoMapForecast = new Map<string, UpstreamCsoSignal | null>();
  await Promise.all(
    locations.map(async (loc) => {
      if (loc.lng == null) {
        upstreamCsoMapForecast.set(loc.id, null);
        return;
      }
      const signal = await getUpstreamCsoForLocation(loc.lng);
      upstreamCsoMapForecast.set(loc.id, signal.count > 0 ? signal : null);
    }),
  );

  const summarized: LocationSummary[] = locations.map((loc) => {
    const opStatus = statusMap.get(loc.id) ?? null;
    const operationalOverride = opStatus
      ? { kind: opStatus.kind, reason: opStatus.reason, affects: opStatus.affects }
      : null;
    const upstreamCso = upstreamCsoMapForecast.get(loc.id) ?? null;

    const combined = combinedLocationStatus(
      {
        gageFt: upriverGageFt,
        // Water temperature not available in the AHPS forecast — omitted so the
        // rules engine uses its safe-default (unknown / not a disqualifying factor).
      },
      advisoriesForRules,
      loc.slug,
      operationalOverride,
      upstreamCso,
      loc.tags,
    );

    return {
      id: loc.id, slug: loc.slug, name: loc.name, tags: loc.tags,
      latestGageFt: upriverGageFt,
      latestWaterTempF: null, // not available in AHPS forecast
      deterministicStatus: { status: combined.status, label: combined.label, reason: combined.reason },
      snapshotAge: null, // forecast data has no snapshot age
      waterQuality: null, // water quality is historical — not shown on forecast views
      upstreamCso,
    };
  });

  summarized.sort((a, b) => {
    const diff = (STATUS_SORT_ORDER[a.deterministicStatus.status] ?? 99)
               - (STATUS_SORT_ORDER[b.deterministicStatus.status] ?? 99);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  return {
    date, ageBucket,
    mode: 'forecast', forecastConfidence,
    locations: summarized,
    activeAdvisories: activeAdvisoryList,
    hasConditions: upriverGageFt !== null,
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Returns today's river conditions (observed) or a forecast-based snapshot
 * (forecast) for any of the 3 forward days in the data window.
 *
 * Throws OutOfWindowError for past dates or dates beyond today+3.
 * Page handlers should catch and redirect to '/'.
 */
export async function getTodayData(date: string, ageBucket: AgeBucket): Promise<TodayData> {
  const todayIso = formatRichmondDate(new Date());

  if (date === todayIso) {
    return getObservedTodayData(date, ageBucket);
  }
  if (date > todayIso && isInWindow(date)) {
    return getForecastTodayData(date, ageBucket, todayIso);
  }

  // Past date or beyond the +3 day window — caller redirects.
  throw new OutOfWindowError(date);
}

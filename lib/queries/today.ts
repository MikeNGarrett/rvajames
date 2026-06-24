import { createServerClient } from '@/lib/supabase/server';
import type { AgeBucket } from '@/lib/url-state';
import { getMetroRiverState } from './river-segment';
import { getActiveStatusMap } from './location-status';
import { getForecast } from './forecast';
import { getAllLatestWaterQualityReadings } from './water-quality';
import type { NoaaAhpsForecastPoint, NoaaAhpsPayload } from '@/lib/ingest/noaa-ahps';
import { combinedLocationStatus, riverWideActivityStatuses, type SafetyStatus } from '@/lib/safety/rules';
import {
  computeLocationActivities,
  type LocationActivityVerdict,
  type JoinedLocationActivity,
} from '@/lib/safety/location-activities';
import { formatRichmondDate, richmondUtcOffset } from '@/lib/utils/date-tz';
import { isInWindow } from '@/lib/queries/date-range';
import { getUpstreamCsoForLocation, addOneDayISO, type UpstreamCsoSignal } from '@/lib/safety/upstream-cso';

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
  /**
   * Age-filtered, verdict-mapped activities for this location. Populated
   * from the location_activities ⨝ activities join, filtered by the
   * youngest-member age bucket via min_age_override-aware logic, and
   * mapped to status verdicts via the rules engine. Empty array when no
   * activities are age-appropriate at this location (e.g. Buttermilk
   * Trail at age 0-2 since the only activity is hike with min_age 2 —
   * but 0-2 means youngest is 0-2, so activity must allow ≤ 2).
   *
   * Drives the ActivityChipRow component in the redesigned tile.
   */
  activities: LocationActivityVerdict[];
}

/**
 * CSO state for the selected date — used by the homepage banner (sub-goal 95)
 * and the per-location upstream signal.
 *
 * activelyDischarging: outfalls with current_overflow=true at last ingest.
 * advisoriesOnSelectedDate: advisory windows that include the selected date
 *   (observed = today, forecast = the forecast date).
 */
export interface CsoState {
  activelyDischarging: {
    /** Number of mainstem outfalls with current_overflow=true at last ingest */
    count: number;
    /** current_overflow_observed_at of the most recently observed active outfall */
    observedAt: string | null;
    /** Hours since observedAt, rounded — null when count === 0 */
    hoursStale: number | null;
  };
  advisoriesOnSelectedDate: {
    /** Number of cso_overflow advisories whose window covers the selected date */
    count: number;
    /** max(effective_to) across matching advisories — null when count === 0 */
    windowEndsAt: string | null;
    /** True if any matching advisory is from a James mainstem outfall */
    anyAffectsJamesMainstem: boolean;
  };
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
  /** CSO state for the selected date — drives homepage banner (sub-goal 95). */
  cso: CsoState;
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

/**
 * Returns the date-filter bounds for the advisoriesOnSelectedDate query.
 * An advisory covers `dateStr` when:
 *   effective_from < ET-midnight-of-next-day  AND  effective_to > ET-midnight-of-selected-day
 *
 * Both bounds are expressed as UTC timestamps anchored to Eastern Time midnight.
 * `dateStr` is always an ET calendar date (produced by `formatRichmondDate`), and
 * advisory timestamps (effective_from / effective_to) are stored in UTC, so the
 * day-boundary must also use ET midnight rather than UTC midnight to avoid a
 * 4–5 hour false-positive/false-negative window around midnight ET.
 *
 * Examples (EDT, UTC-4):
 *   buildAdvisoryDateFilter('2026-05-30')
 *   → { fromLt: '2026-05-31T04:00:00Z', toGt: '2026-05-30T04:00:00Z' }
 *
 * Examples (EST, UTC-5):
 *   buildAdvisoryDateFilter('2026-12-31')
 *   → { fromLt: '2027-01-01T05:00:00Z', toGt: '2026-12-31T05:00:00Z' }
 *
 * Exported for unit testing.
 */
export function buildAdvisoryDateFilter(dateStr: string): { fromLt: string; toGt: string } {
  const nextDay     = addOneDayISO(dateStr);
  // Compute the ET offset for each day separately so DST transitions are handled
  // correctly: on fall-back day (EDT→EST, e.g. Nov 7→8), the start uses UTC-4
  // and the end uses UTC-5, making the ET day 25h as expected.
  const startOffset = richmondUtcOffset(dateStr);
  const endOffset   = richmondUtcOffset(nextDay);
  return {
    fromLt: `${nextDay}T${String(endOffset).padStart(2, '0')}:00:00Z`,
    toGt:   `${dateStr}T${String(startOffset).padStart(2, '0')}:00:00Z`,
  };
}

/** Empty CsoState — used when there's no data or as a safe default. */
const EMPTY_CSO_STATE: CsoState = {
  activelyDischarging:       { count: 0, observedAt: null, hoursStale: null },
  advisoriesOnSelectedDate:  { count: 0, windowEndsAt: null, anyAffectsJamesMainstem: false },
};

/**
 * Computes CsoState for the given date via two parallel Supabase queries:
 *  1. cso_outfalls WHERE current_overflow=true AND affects_james_mainstem=true
 *  2. advisories WHERE kind='cso_overflow' AND window covers dateStr
 */
/**
 * Computes the two-signal CSO state for the given date.
 *
 * Exported so callers outside today.ts (e.g. lib/queries/metro-summary.ts)
 * use the same query rather than reimplementing — sub-goal 96's first cut
 * derived activelyDischarging.count from the advisory list, which diverges
 * from the true live-overflow count any time an outfall stops discharging
 * while its 48h advisory window remains open. Both paths must use this
 * function.
 */
export async function computeCsoState(dateStr: string): Promise<CsoState> {
  const supabase = await createServerClient('anon');
  const { fromLt, toGt } = buildAdvisoryDateFilter(dateStr);

  const [{ data: dischargingRows }, { data: advisoryRows }] = await Promise.all([
    supabase
      .from('cso_outfalls')
      .select('current_overflow_observed_at')
      .eq('current_overflow', true)
      .eq('affects_james_mainstem', true),
    supabase
      .from('advisories')
      .select('effective_to, cso_outfalls!inner(affects_james_mainstem)')
      .eq('kind', 'cso_overflow')
      .lt('effective_from', fromLt)
      .gt('effective_to', toGt),
  ]);

  // activelyDischarging
  const rows = dischargingRows ?? [];
  const observedAt = rows
    .map((r) => r.current_overflow_observed_at)
    .filter((v): v is string => v != null)
    .sort()
    .at(-1) ?? null;

  // advisoriesOnSelectedDate
  const advRows = advisoryRows ?? [];
  const windowEndsAt = advRows
    .map((r) => r.effective_to)
    .filter((v): v is string => v != null)
    .sort()
    .at(-1) ?? null;
  const anyAffectsJamesMainstem = advRows.some(
    (r) => (r.cso_outfalls as { affects_james_mainstem: boolean } | null)?.affects_james_mainstem,
  );

  return {
    activelyDischarging: {
      count: rows.length,
      observedAt,
      hoursStale: observedAt
        ? Math.round((Date.now() - new Date(observedAt).getTime()) / 3_600_000)
        : null,
    },
    advisoriesOnSelectedDate: {
      count: advRows.length,
      windowEndsAt,
      anyAffectsJamesMainstem,
    },
  };
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

/**
 * Fetch per-location activity rows joined with activity metadata.
 *
 * One round-trip for all visible locations. Returns a Map keyed by
 * location_id with each entry shaped to feed computeLocationActivities.
 *
 * Supabase types the embedded `activities` relation as either an object
 * (many-to-one FK) or array depending on the inferred relationship
 * direction; both shapes are handled defensively.
 */
async function fetchActivitiesByLocation(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  locationIds: string[],
): Promise<Map<string, JoinedLocationActivity[]>> {
  const map = new Map<string, JoinedLocationActivity[]>();
  if (locationIds.length === 0) return map;

  const { data } = await supabase
    .from('location_activities')
    .select('location_id, min_age_override, activities(slug, name, min_age)')
    .in('location_id', locationIds);

  if (!data) return map;

  for (const row of data) {
    const raw = row.activities as unknown;
    const activity = Array.isArray(raw) ? raw[0] : raw;
    if (!activity || typeof activity !== 'object') continue;
    const a = activity as { slug?: string; name?: string; min_age?: number };
    if (typeof a.slug !== 'string' || typeof a.name !== 'string' || typeof a.min_age !== 'number') {
      continue;
    }

    const existing = map.get(row.location_id) ?? [];
    existing.push({
      min_age_override: row.min_age_override,
      activity: { slug: a.slug, name: a.name, min_age: a.min_age },
    });
    map.set(row.location_id, existing);
  }
  return map;
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

  const [{ data: locations }, { data: advisories }, metroState, statusMap, wqReadings, cso] = await Promise.all([
    supabase
      .from('locations')
      .select('id, slug, name, tags, lng')
      .eq('kind', 'access_point')
      .eq('published', true)
      .order('name'),
    supabase
      .from('advisories')
      .select('id, kind, severity, headline, body')
      .or(`effective_to.is.null,effective_to.gte.${now.toISOString()}`)
      .order('severity', { ascending: false }),
    getMetroRiverState(),
    getActiveStatusMap(now),
    wqPromise,
    computeCsoState(date),
  ]);

  if (!locations?.length) {
    return {
      date, ageBucket,
      mode: 'observed', forecastConfidence: null,
      locations: [], activeAdvisories: [], hasConditions: false,
      cso: EMPTY_CSO_STATE,
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

  // Fetch per-location activities (location_activities ⨝ activities) +
  // upstream CSO signals in parallel.
  const locationIds = locations.map((l) => l.id);
  const [activitiesByLocation, _csoMapPopulated] = await Promise.all([
    fetchActivitiesByLocation(supabase, locationIds),
    Promise.all(
      locations.map(async (loc) => {
        if (loc.lng == null) return [loc.id, null] as const;
        const signal = await getUpstreamCsoForLocation(loc.lng);
        return [loc.id, signal.count > 0 ? signal : null] as const;
      }),
    ),
  ]);
  // _csoMapPopulated is the resolved tuple list; map it.
  const upstreamCsoMap = new Map<string, UpstreamCsoSignal | null>(_csoMapPopulated);

  // Severe-weather is regional, so hasHighSeverityAdvisory is metro-wide. The
  // CSO swim-hold, by contrast, is per-location: a location's swimming is only
  // CSO-restricted when there's an active overflow UPSTREAM of it. So the
  // river-wide verdicts are computed per location below (gage/temp identical;
  // only the CSO gate varies) to keep the swim chip consistent with the card.
  const hasHighSeverityAdvisory = advisoriesForRules.some((a) => a.severity === 'high' || a.severity === 'extreme');

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

    const riverwideVerdicts = upriverGageFt !== null
      ? riverWideActivityStatuses({
          upriverGageFt,
          waterTempF: upriverWaterTempF ?? null,
          rain48hIn: 0, // TODO: source from NWS precip when available
          activeCSOAdvisory: (upstreamCso?.count ?? 0) > 0, // per-location
          hasHighSeverityAdvisory,
        })
      : [];

    const activities = computeLocationActivities({
      locationActivities: activitiesByLocation.get(loc.id) ?? [],
      ageBucket,
      metroState: { gageFt: upriverGageFt },
      riverwideVerdicts,
    });

    return {
      id: loc.id, slug: loc.slug, name: loc.name, tags: loc.tags,
      latestGageFt: upriverGageFt,
      latestWaterTempF: upriverWaterTempF,
      deterministicStatus: { status: combined.status, label: combined.label, reason: combined.reason },
      snapshotAge,
      waterQuality: computeWaterQualityBadge(wqReadings[loc.slug] ?? null),
      upstreamCso,
      activities,
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
    cso,
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

  const [{ data: locations }, { data: advisories }, forecast, statusMap, cso] = await Promise.all([
    supabase
      .from('locations')
      .select('id, slug, name, tags, lng')
      .eq('kind', 'access_point')
      .eq('published', true)
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
    computeCsoState(date),
  ]);

  const forecastConfidence = computeConfidence(date, todayIso);

  if (!locations?.length) {
    return {
      date, ageBucket,
      mode: 'forecast', forecastConfidence,
      locations: [], activeAdvisories: [], hasConditions: false,
      cso: EMPTY_CSO_STATE,
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

  // Fetch per-location activities + upstream CSO signals in parallel.
  // For forecast dates, pass forSelectedDate to getUpstreamCsoForLocation
  // so the query uses date-overlap (advisory window covers the forecast
  // date) rather than a now()-anchored window.
  const locationIds = locations.map((l) => l.id);
  const [activitiesByLocation, _csoMapPopulated] = await Promise.all([
    fetchActivitiesByLocation(supabase, locationIds),
    Promise.all(
      locations.map(async (loc) => {
        if (loc.lng == null) return [loc.id, null] as const;
        const signal = await getUpstreamCsoForLocation(loc.lng, 48, date);
        return [loc.id, signal.count > 0 ? signal : null] as const;
      }),
    ),
  ]);
  const upstreamCsoMapForecast = new Map<string, UpstreamCsoSignal | null>(_csoMapPopulated);

  // Severe-weather is regional (metro-wide); the CSO swim-hold is per-location
  // (gated on each location's upstream signal), so river-wide verdicts are
  // computed per location below. Forecast mode has no water-temp (AHPS doesn't
  // publish it), so temp-based caution branches default to safe.
  const hasHighSeverityAdvisory = advisoriesForRules.some((a) => a.severity === 'high' || a.severity === 'extreme');

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

    const riverwideVerdicts = upriverGageFt !== null
      ? riverWideActivityStatuses({
          upriverGageFt,
          waterTempF: null,
          rain48hIn: 0,
          activeCSOAdvisory: (upstreamCso?.count ?? 0) > 0, // per-location
          hasHighSeverityAdvisory,
        })
      : [];

    const activities = computeLocationActivities({
      locationActivities: activitiesByLocation.get(loc.id) ?? [],
      ageBucket,
      metroState: { gageFt: upriverGageFt },
      riverwideVerdicts,
    });

    return {
      id: loc.id, slug: loc.slug, name: loc.name, tags: loc.tags,
      latestGageFt: upriverGageFt,
      latestWaterTempF: null, // not available in AHPS forecast
      deterministicStatus: { status: combined.status, label: combined.label, reason: combined.reason },
      snapshotAge: null, // forecast data has no snapshot age
      waterQuality: null, // water quality is historical — not shown on forecast views
      upstreamCso,
      activities,
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
    cso,
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

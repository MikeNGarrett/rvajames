import { createServerClient } from '@/lib/supabase/server';
import type { AgeBucket } from '@/lib/url-state';
import { getOrGenerate } from '@/lib/ai/get-or-generate';
import type { InterpretLocationInput, WaterQualityInput } from '@/lib/ai/prompts/interpret-location';
import { computeWqFreshness } from '@/lib/ai/prompts/interpret-location';
import { combinedLocationStatus, severeWeatherStatus } from '@/lib/safety/rules';
import { getLatestWaterQualityReading, getLatestReadingByStationCode, type WaterQualityReading } from './water-quality';
import { getStationConfig } from '@/lib/data/station-mapping';
import { resolveDateMode } from './date-range';
import { getUpstreamCsoForLocation, type UpstreamCsoSignal } from '@/lib/safety/upstream-cso';

export interface LocationDetail {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  activities: { slug: string; name: string; minAge: number; requiresSwim: boolean }[];
  latestSnapshot: {
    gageFt: number | null;
    dischargeCfs: number | null;
    waterTempF: number | null;
    airTempF: number | null;
    fetchedAt: string;
    ageMinutes: number;
  } | null;
  deterministicStatus: {
    status: 'safe' | 'caution' | 'danger' | 'closed';
    label: string;
    reason: string;
  };
  interpretation: {
    status: 'safe' | 'caution' | 'danger' | 'flood';
    headline: string;
    body_md: string;
    activities: { slug: string; status: string; note: string }[];
    prep_items: string[];
    attribution: string[];
  } | null;
  activeAdvisories: {
    id: string;
    kind: string;
    severity: string;
    headline: string;
    body: string;
  }[];
  resources: {
    id: string;
    title: string;
    url: string;
    kind: 'official' | 'parks' | 'safety' | 'community';
    sort_order: number;
  }[];
  /**
   * Latest water quality reading for the mapped JRA station, plus capability
   * metadata from the station mapping.
   *
   * null when:
   *   - This slug has no mapped JRA station (e.g. USGS gauge slugs)
   *   - No readings exist yet for the mapped station
   */
  waterQuality: {
    reading: WaterQualityReading;
    /** True when the primary station tests enterococcus (currently always false — all JRA stations are E. coli–only). */
    testsEnterococcus: boolean;
  } | null;
  /**
   * Upstream CSO signal. null when no active advisories from upstream outfalls
   * within the 48-hour window, or when the location has no lng (defensive).
   * null is equivalent to count === 0.
   */
  upstreamCso: UpstreamCsoSignal | null;
}

const UPRIVER_STATION = '02037500';

/**
 * Options for getLocationDetail.
 *
 * skipInterpretation — when true, the function returns deterministic data
 * (snapshot, advisories, water quality, upstream CSO, resources) without
 * calling the AI. interpretation is set to null in the response.
 *
 * The location *page* passes this flag now (sub-goal 66) so the server
 * render no longer blocks on Anthropic latency. The /api/location-
 * interpretation route, which is the client-side AI fetcher, does NOT
 * pass the flag — it explicitly wants the AI result.
 */
export interface GetLocationDetailOptions {
  skipInterpretation?: boolean;
}

export async function getLocationDetail(
  slug: string,
  date: string,
  ageBucket: AgeBucket,
  opts: GetLocationDetailOptions = {},
): Promise<LocationDetail | null> {
  const supabase = await createServerClient('anon');

  // Fetch the access point location. Unpublished locations (locations.published=false)
  // are intentionally invisible — /locations/[slug] will 404 for them. This matches the
  // homepage grid which also excludes unpublished rows.
  const { data: loc } = await supabase
    .from('locations')
    .select('id, slug, name, lat, lng, tags')
    .eq('slug', slug)
    .eq('kind', 'access_point')
    .eq('published', true)
    .single();

  if (!loc) return null;

  // Resolve date mode early so we can pass forSelectedDate to the CSO query for
  // forecast dates. For observed mode, the default now()-anchored 48h window is
  // used; for forecast, we use date-overlap so the upstream signal reflects
  // advisory windows that cover the forecast date rather than "active right now."
  const { mode, daysOut, forecastConfidence } = resolveDateMode(date);

  // Resolve station config synchronously (no DB call) so we can kick off all
  // parallel fetches before entering the Promise.all.
  const stationConfig = getStationConfig(slug);

  // Kick off water quality and upstream CSO fetches before the Promise.all so
  // they run in parallel with the main DB queries.
  const wqPromise = getLatestWaterQualityReading(slug);
  const upstreamWatchCode = stationConfig?.upstreamWatchStations?.[0]?.code ?? null;
  const upstreamWatchPromise: Promise<WaterQualityReading | null> = upstreamWatchCode
    ? getLatestReadingByStationCode(upstreamWatchCode)
    : Promise.resolve(null);
  const upstreamCsoPromise = loc.lng != null
    ? getUpstreamCsoForLocation(
        Number(loc.lng),
        48,
        mode === 'forecast' ? date : undefined,
      )
    : Promise.resolve({ count: 0, mostRecentAt: null, outfalls: [] } as UpstreamCsoSignal);

  // Run parallel queries
  const [
    { data: locActivities },
    { data: gaugeRow },
    { data: advisories },
    { data: nwsSnap },
    { data: resourceRows },
  ] = await Promise.all([
    supabase
      .from('location_activities')
      .select('activities(slug, name, min_age, requires_swim)')
      .eq('location_id', loc.id),
    // Gauge data comes from the upriver gauge location, not the access point
    supabase
      .from('locations')
      .select('id')
      .eq('usgs_station_id', UPRIVER_STATION)
      .eq('kind', 'gauge')
      .single(),
    supabase
      .from('advisories')
      .select('id, kind, severity, headline, body, location_ids')
      .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`),
    supabase
      .from('conditions_snapshots')
      .select('air_temp_f, precip_in, fetched_at')
      .eq('source', 'nws_hourly')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('location_resources')
      .select('id, title, url, kind, sort_order')
      .eq('location_id', loc.id)
      .order('sort_order'),
  ]);

  // Fetch latest snapshot for the upriver gauge
  const gaugeLocationId = gaugeRow?.id ?? null;
  const { data: snapshots } = gaugeLocationId
    ? await supabase
        .from('conditions_snapshots')
        .select('gage_ft, discharge_cfs, water_temp_f, air_temp_f, fetched_at')
        .eq('location_id', gaugeLocationId)
        .eq('source', 'usgs')
        .order('fetched_at', { ascending: false })
        .limit(1)
    : { data: null };

  const activities = (locActivities ?? []).flatMap((la) => {
    const a = la.activities as { slug: string; name: string; min_age: number; requires_swim: boolean } | null;
    return a ? [{ slug: a.slug, name: a.name, minAge: a.min_age, requiresSwim: a.requires_swim }] : [];
  });

  // Await the water quality and CSO fetches (all kicked off in parallel above).
  const [wqReading, upstreamWatchReading, upstreamCsoRaw] = await Promise.all([
    wqPromise,
    upstreamWatchPromise,
    upstreamCsoPromise,
  ]);
  const upstreamCso: UpstreamCsoSignal | null = upstreamCsoRaw.count > 0 ? upstreamCsoRaw : null;

  const testsEnterococcus =
    stationConfig?.primaryStations.some((s) => s.bacteria.includes('enterococcus')) ?? false;
  const waterQuality = wqReading
    ? { reading: wqReading, testsEnterococcus }
    : null;

  // Build structured water quality input for the AI per-call message.
  const waterQualityInput: WaterQualityInput | null = stationConfig
    ? {
        primaryStation: wqReading
          ? {
              stationCode:            wqReading.stationCode ?? '',
              stationName:            wqReading.stationName,
              ecoliCfuPer100ml:       wqReading.ecoliCfuPer100ml,
              enterococciCfuPer100ml: wqReading.enterococciCfuPer100ml,
              daysOld:                wqReading.daysOld,
              freshness:              computeWqFreshness(wqReading.daysOld),
              testsEnterococcus,
            }
          : null,
        watchStation: upstreamWatchReading
          ? {
              stationCode:      upstreamWatchReading.stationCode ?? '',
              stationName:      upstreamWatchReading.stationName,
              ecoliCfuPer100ml: upstreamWatchReading.ecoliCfuPer100ml,
              daysOld:          upstreamWatchReading.daysOld,
              freshness:        computeWqFreshness(upstreamWatchReading.daysOld),
            }
          : null,
      }
    : null;

  const snap = snapshots?.[0] ?? null;
  const latestSnapshot = snap
    ? {
        gageFt: snap.gage_ft,
        dischargeCfs: snap.discharge_cfs,
        waterTempF: snap.water_temp_f,
        airTempF: snap.air_temp_f ?? nwsSnap?.air_temp_f ?? null,
        fetchedAt: snap.fetched_at,
        ageMinutes: Math.round((Date.now() - new Date(snap.fetched_at).getTime()) / 60_000),
      }
    : null;

  const activeAdvisories = (advisories ?? [])
    .filter((a) => a.location_ids.length === 0 || a.location_ids.includes(loc.id))
    .map((a) => ({ id: a.id, kind: a.kind, severity: a.severity, headline: a.headline, body: a.body }));

  // Deterministic status (always available, no AI)
  const deterministicStatus = combinedLocationStatus(
    {
      gageFt: snap?.gage_ft ?? null,
      waterTempF: snap?.water_temp_f ?? null,
    },
    activeAdvisories,
    loc.slug,
    undefined, // operationalOverride — handled via advisories table
    upstreamCso ?? undefined,
    loc.tags,
  );

  // AI interpretation — the expensive call. Skipped server-side when the
  // page is rendering deterministic content + delegating the AI fetch to
  // the client (sub-goal 66's split). The /api/location-interpretation
  // route still passes the default (skipInterpretation: false) to do the
  // actual AI work.
  let interpretation: LocationDetail['interpretation'] = null;

  if (!opts.skipInterpretation) {
    const hasHighSeverity = activeAdvisories.some(
      (a) => a.severity === 'high' || a.severity === 'extreme',
    );

    const activitySlugs = activities.map((a) => a.slug);

    const interpretInput: InterpretLocationInput = {
      date,
      locationSlug: loc.slug,
      locationName: loc.name,
      ageBucket,
      mode,
      forecastConfidence,
      daysOut,
      gageFt: snap?.gage_ft ?? null,
      dischargeCfs: snap?.discharge_cfs ?? null,
      // Water temperature not available in AHPS forecast — omit so the AI doesn't
      // report a stale or live reading as if it were forecast data.
      waterTempF: mode === 'forecast' ? null : (snap?.water_temp_f ?? null),
      airTempF: snap?.air_temp_f ?? nwsSnap?.air_temp_f ?? null,
      precip24hIn: null, // NWS stores probability not measured inches; TODO: wire actual precip
      dataAgeMinutes: mode === 'forecast' ? null : (latestSnapshot?.ageMinutes ?? null),
      activeAdvisoryHeadlines: activeAdvisories.map((a) => a.headline),
      // Deterministic severe-weather gate — directs the AI to suppress activity
      // recommendations under an active NWS watch/warning.
      severeWeather: severeWeatherStatus(activeAdvisories),
      availableActivitySlugs: activitySlugs,
      waterQuality: waterQualityInput,
      // Project to count-only shape for the AI prompt (sub-goal 96).
      // UpstreamCsoSignal still carries the full outfalls array for the UI
      // (UpstreamCsoPanel) but the AI input intentionally omits outfall names.
      upstreamCso: upstreamCso
        ? { count: upstreamCso.count, mostRecentAt: upstreamCso.mostRecentAt }
        : null,
    };

    const genResult = await getOrGenerate(interpretInput, loc.id, hasHighSeverity);

    if (genResult) {
      interpretation = {
        status: genResult.interpretation.status,
        headline: genResult.interpretation.headline,
        body_md: genResult.interpretation.body_md,
        activities: genResult.interpretation.activities,
        prep_items: genResult.interpretation.prep_items,
        attribution: genResult.interpretation.attribution,
      };
    }
  }

  return {
    id: loc.id,
    slug: loc.slug,
    name: loc.name,
    lat: Number(loc.lat),
    lng: Number(loc.lng),
    tags: loc.tags,
    activities,
    latestSnapshot,
    deterministicStatus,
    interpretation,
    activeAdvisories,
    resources: (resourceRows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      kind: r.kind as 'official' | 'parks' | 'safety' | 'community',
      sort_order: r.sort_order,
    })),
    waterQuality,
    upstreamCso,
  };
}

export async function getAllLocationSlugs(): Promise<string[]> {
  const supabase = await createServerClient('anon');
  // Sitemap excludes unpublished locations so search engines don't index them.
  const { data } = await supabase
    .from('locations')
    .select('slug')
    .eq('kind', 'access_point')
    .eq('published', true);
  return data?.map((l) => l.slug) ?? [];
}

/**
 * Lightweight name-only lookup for the slug → display-name mapping.
 *
 * Used by app/locations/[slug]/page.tsx generateMetadata() so SEO + social
 * preview titles don't fall back to the raw slug for new locations. The
 * full getLocationDetail() is overkill for metadata generation (it
 * resolves water quality, CSO state, advisories, etc.) — this version
 * issues a single single-row query.
 *
 * Returns null when the slug doesn't exist OR the location is
 * unpublished, matching getLocationDetail's visibility semantics. The
 * caller falls back to the slug literal in either case.
 */
export async function getLocationNameBySlug(slug: string): Promise<string | null> {
  const supabase = await createServerClient('anon');
  const { data } = await supabase
    .from('locations')
    .select('name')
    .eq('slug', slug)
    .eq('kind', 'access_point')
    .eq('published', true)
    .maybeSingle();
  return data?.name ?? null;
}

import { createServerClient } from '@/lib/supabase/server';
import type { AgeBucket } from '@/lib/url-state';
import { getOrGenerate } from '@/lib/ai/get-or-generate';
import type { InterpretLocationInput } from '@/lib/ai/prompts/interpret-location';
import { combinedLocationStatus } from '@/lib/safety/rules';

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
}

const UPRIVER_STATION = '02037500';

export async function getLocationDetail(
  slug: string,
  date: string,
  ageBucket: AgeBucket,
): Promise<LocationDetail | null> {
  const supabase = await createServerClient('anon');

  // Fetch the access point location
  const { data: loc } = await supabase
    .from('locations')
    .select('id, slug, name, lat, lng, tags')
    .eq('slug', slug)
    .eq('kind', 'access_point')
    .single();

  if (!loc) return null;

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
  );

  // Lazy AI interpretation for the detail page
  const hasHighSeverity = activeAdvisories.some(
    (a) => a.severity === 'high' || a.severity === 'extreme',
  );

  const activitySlugs = activities.map((a) => a.slug);

  const interpretInput: InterpretLocationInput = {
    date,
    locationSlug: loc.slug,
    locationName: loc.name,
    ageBucket,
    gageFt: snap?.gage_ft ?? null,
    dischargeCfs: snap?.discharge_cfs ?? null,
    waterTempF: snap?.water_temp_f ?? null,
    airTempF: snap?.air_temp_f ?? nwsSnap?.air_temp_f ?? null,
    precip24hIn: null, // NWS stores probability not measured inches; TODO: wire actual precip
    dataAgeMinutes: latestSnapshot?.ageMinutes ?? null,
    activeAdvisoryHeadlines: activeAdvisories.map((a) => a.headline),
    availableActivitySlugs: activitySlugs,
  };

  const genResult = await getOrGenerate(interpretInput, loc.id, hasHighSeverity);

  let interpretation: LocationDetail['interpretation'] = null;
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
  };
}

export async function getAllLocationSlugs(): Promise<string[]> {
  const supabase = await createServerClient('anon');
  const { data } = await supabase.from('locations').select('slug').eq('kind', 'access_point');
  return data?.map((l) => l.slug) ?? [];
}

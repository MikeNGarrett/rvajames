import { createServerClient } from '@/lib/supabase/server';

export interface GaugeReading {
  locationId: string;
  slug: string;
  name: string;
  stationId: string;
  /**
   * For 02037500 (upriver): gage height, arbitrary datum (ft). This is the primary
   * safety reference — all published flood thresholds use this datum.
   *
   * For 02037705 (downriver/City Locks): water surface elevation above NAVD 1988 (ft),
   * parameter 62620. Tidal station — value oscillates with the tide (~-2 to +2 ft).
   * NOT comparable to 02037500's gage height (different datum).
   */
  gageFt: number | null;
  dischargeCfs: number | null;
  waterTempF: number | null;
  fetchedAt: string | null;
  /** True for 02037705 — reading is NAVD 1988 tidal elevation, not gage height */
  isTidalElevation: boolean;
}

export interface MetroRiverState {
  /** Westham gauge — 02037500, upriver reference. Gage height (arbitrary datum). */
  upriver: GaugeReading;
  /**
   * City Locks gauge — 02037705, fall-line tidal station.
   * Measures water surface elevation above NAVD 1988 (parameter 62620).
   * Values are NOT comparable to upriver gage height — different datums.
   * Useful for: detecting tidal backwater effect, qualitative flow direction.
   */
  downriver: GaugeReading;
  /** Most recent fetched_at across both gauges */
  lastUpdatedAt: string | null;
}

const UPRIVER_STATION = '02037500';
const DOWNRIVER_STATION = '02037705';

/** Returns the latest conditions snapshot for each of the two metro gauges. */
export async function getMetroRiverState(): Promise<MetroRiverState> {
  const supabase = await createServerClient('anon');

  const { data: gauges } = await supabase
    .from('locations')
    .select('id, slug, name, usgs_station_id')
    .eq('kind', 'gauge')
    .in('usgs_station_id', [UPRIVER_STATION, DOWNRIVER_STATION]);

  const gaugeMap: Record<string, { id: string; slug: string; name: string }> = {};
  for (const g of gauges ?? []) {
    if (g.usgs_station_id) gaugeMap[g.usgs_station_id] = { id: g.id, slug: g.slug, name: g.name };
  }

  const gaugeIds = Object.values(gaugeMap).map((g) => g.id);

  const { data: snapshots } = await supabase
    .from('conditions_snapshots')
    .select('location_id, gage_ft, discharge_cfs, water_temp_f, fetched_at')
    .in('location_id', gaugeIds.length ? gaugeIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('source', 'usgs')
    .order('fetched_at', { ascending: false })
    .limit(10);

  const latestByStation: Record<string, typeof snapshots extends (infer T)[] | null ? T : never> = {};
  for (const snap of snapshots ?? []) {
    if (!latestByStation[snap.location_id]) latestByStation[snap.location_id] = snap;
  }

  function makeReading(stationId: string): GaugeReading {
    const meta = gaugeMap[stationId];
    const snap = meta ? latestByStation[meta.id] : undefined;
    return {
      locationId: meta?.id ?? '',
      slug: meta?.slug ?? `usgs-${stationId}`,
      name: meta?.name ?? `USGS ${stationId}`,
      stationId,
      gageFt: snap?.gage_ft ?? null,
      dischargeCfs: snap?.discharge_cfs ?? null,
      waterTempF: snap?.water_temp_f ?? null,
      fetchedAt: snap?.fetched_at ?? null,
      isTidalElevation: stationId === DOWNRIVER_STATION,
    };
  }

  const upriver = makeReading(UPRIVER_STATION);
  const downriver = makeReading(DOWNRIVER_STATION);

  const dates = [upriver.fetchedAt, downriver.fetchedAt].filter(Boolean) as string[];
  const lastUpdatedAt = dates.length
    ? dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
    : null;

  // Note: avgGageFt and deltaGageFt have been intentionally removed.
  // The two readings use different datums (02037500 = arbitrary gage datum;
  // 02037705 = NAVD 1988 tidal elevation) and cannot be numerically compared.
  return { upriver, downriver, lastUpdatedAt };
}

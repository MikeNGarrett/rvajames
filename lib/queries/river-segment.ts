import { createServerClient } from '@/lib/supabase/server';
import { getWesthamDischargeNormalRange, type NormalRange } from '@/lib/queries/normal-range';
import {
  riverConditionSummary,
  rapidsClass,
  type RiverConditionSummary,
} from '@/lib/safety/rules';

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
  /**
   * Historical discharge percentiles for today's day-of-year (USGS 02037500, param 00060).
   * Null before the first usgs-percentiles cron run.
   */
  normalRange: NormalRange | null;
  /**
   * Last 72 h of gage readings for the sparkline. Each point is
   * { t: Unix-ms, v: gage_ft }. Empty array if no history available.
   */
  recent72h: { t: number; v: number }[];
  /**
   * Deterministic river condition summary (band, headline, deltaLabel, translation).
   * Computed server-side from the current reading + normal range.
   */
  summary: RiverConditionSummary;
}

const UPRIVER_STATION = '02037500';
const DOWNRIVER_STATION = '02037705';

/** Returns the latest conditions snapshot for each of the two metro gauges. */
export async function getMetroRiverState(
  ageBucket?: string | null,
): Promise<MetroRiverState> {
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

  const upriver  = makeReading(UPRIVER_STATION);
  const downriver = makeReading(DOWNRIVER_STATION);

  const dates = [upriver.fetchedAt, downriver.fetchedAt].filter(Boolean) as string[];
  const lastUpdatedAt = dates.length
    ? dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
    : null;

  // ── Enrich with percentiles and 72h history ─────────────────────────────

  const [normalRange, sparkSnaps] = await Promise.all([
    getWesthamDischargeNormalRange(new Date()),
    // Last 72h of gage readings for the sparkline
    supabase
      .from('conditions_snapshots')
      .select('fetched_at, gage_ft')
      .eq('location_id', gaugeMap[UPRIVER_STATION]?.id ?? '')
      .eq('source', 'usgs')
      .gte('fetched_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
      .order('fetched_at', { ascending: true })
      .limit(300),
  ]);

  const recent72h: { t: number; v: number }[] = (sparkSnaps.data ?? [])
    .filter((s) => s.gage_ft !== null)
    .map((s) => ({
      t: new Date(s.fetched_at).getTime(),
      v: s.gage_ft as number,
    }));

  // ── Deterministic river condition summary ────────────────────────────────

  const classValue = upriver.gageFt !== null
    ? rapidsClass(upriver.gageFt).class
    : 'I-II' as const;

  const summary = riverConditionSummary({
    currentGageFt:          upriver.gageFt ?? 0,
    dischargeNormal:        normalRange
      ? { p25: normalRange.p25, p50: normalRange.p50, p75: normalRange.p75, unit: 'cfs' }
      : null,
    currentDischargeCfs:    upriver.dischargeCfs,
    rapidsClass:            classValue,
    activeAdvisorySeverity: null, // advisories fetched separately in page.tsx
    ageBucket,
  });

  // Note: avgGageFt and deltaGageFt have been intentionally removed.
  // The two readings use different datums (02037500 = arbitrary gage datum;
  // 02037705 = NAVD 1988 tidal elevation) and cannot be numerically compared.
  return { upriver, downriver, lastUpdatedAt, normalRange, recent72h, summary };
}

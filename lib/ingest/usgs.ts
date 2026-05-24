import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { RunResult } from './run';

// Parameter codes
const PARAM_GAGE_HT = '00065';       // Gage height, ft (arbitrary datum) — 02037500 Westham
const PARAM_DISCHARGE = '00060';     // Discharge, cfs
const PARAM_WATER_TEMP = '00010';    // Water temperature, °C
const PARAM_TIDAL_ELEV = '62620';    // Estuary water surface elevation above NAVD 1988, ft — 02037705 City Locks

/**
 * Temperature proxy — neither Richmond gauge has an active water temp sensor:
 *   02037500 (Westham) reports only 00060 + 00065
 *   02037705 (City Locks) reports only 62620 (tidal elevation)
 *
 * USGS 02035000 (James River at Cartersville, VA) is ~40 mi upstream and has a
 * live 00010 sensor. Water temperature changes slowly over river distance, so
 * this gives a reasonable ±2–4 °F ballpark for the Richmond reach — good enough
 * for family swim/paddle safety guidance.
 *
 * We include this station in the API request but do NOT write a conditions_snapshot
 * row for it (no matching location in the DB). It is used only as a fallback value
 * for stations that lack their own temp reading.
 */
const TEMP_PROXY_STATION = '02035000'; // James River at Cartersville, VA
const TEMP_PROXY_FOR: Record<string, string> = {
  '02037500': TEMP_PROXY_STATION,
  '02037705': TEMP_PROXY_STATION,
};

const ValueSchema = z.object({
  value: z.string(),
  dateTime: z.string(),
});

const TimeSeriesSchema = z.object({
  variable: z.object({
    variableCode: z.array(z.object({ value: z.string() })),
  }),
  values: z.array(z.object({ value: z.array(ValueSchema) })),
  sourceInfo: z.object({
    siteCode: z.array(z.object({ value: z.string() })),
  }),
});

const UsgsResponseSchema = z.object({
  value: z.object({
    timeSeries: z.array(TimeSeriesSchema),
  }),
});

function latestNumeric(series: z.infer<typeof TimeSeriesSchema>): number | null {
  const values = series.values[0]?.value;
  if (!values?.length) return null;
  const last = values[values.length - 1];
  const n = parseFloat(last.value);
  return isNaN(n) || last.value === '-999999' ? null : n;
}

export async function runUsgsIngestion(): Promise<RunResult> {
  const supabase = await createServerClient('service');

  // Pull gauge locations to determine which USGS stations to fetch
  const { data: gaugeLocations, error: locErr } = await supabase
    .from('locations')
    .select('id, slug, usgs_station_id')
    .eq('kind', 'gauge');

  if (locErr) {
    return { ok: false, rowsWritten: 0, error: `Failed to load gauge locations: ${locErr.message}` };
  }
  if (!gaugeLocations?.length) {
    return { ok: false, rowsWritten: 0, error: 'No gauge locations found in DB' };
  }

  const stationIds = [...new Set(
    gaugeLocations
      .map((l) => l.usgs_station_id)
      .filter((id): id is string => Boolean(id))
  )];

  // Include the temperature proxy station alongside the gauge stations.
  // USGS returns only the params that exist for each site, so requesting all four
  // param codes for all three stations is harmless — no error if a param is absent.
  const allFetchStations = [...new Set([...stationIds, TEMP_PROXY_STATION])];
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${allFetchStations.join(',')}&parameterCd=${PARAM_GAGE_HT},${PARAM_DISCHARGE},${PARAM_WATER_TEMP},${PARAM_TIDAL_ELEV}&period=P1D`;

  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    return { ok: false, rowsWritten: 0, error: `USGS HTTP ${resp.status}` };
  }

  const json = await resp.json();
  const parsed = UsgsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, rowsWritten: 0, error: `Parse error: ${parsed.error.message}` };
  }

  // Index timeseries by stationId → paramCode → value
  type StationData = { gageFt: number | null; dischargeCfs: number | null; waterTempF: number | null };
  const stationData: Record<string, StationData> = {};

  for (const series of parsed.data.value.timeSeries) {
    const stationId = series.sourceInfo.siteCode[0]?.value;
    const paramCode = series.variable.variableCode[0]?.value;
    if (!stationId || !paramCode) continue;

    if (!stationData[stationId]) {
      stationData[stationId] = { gageFt: null, dischargeCfs: null, waterTempF: null };
    }

    const val = latestNumeric(series);
    if (paramCode === PARAM_GAGE_HT) {
      stationData[stationId].gageFt = val;
    } else if (paramCode === PARAM_TIDAL_ELEV) {
      // 02037705 City Locks: water surface elevation above NAVD 1988 (ft).
      // Stored in gageFt for structural consistency; NOT comparable to 02037500's
      // gage height (arbitrary datum). Used for tidal context only.
      stationData[stationId].gageFt = val;
    } else if (paramCode === PARAM_DISCHARGE) {
      stationData[stationId].dischargeCfs = val;
    } else if (paramCode === PARAM_WATER_TEMP && val !== null) {
      stationData[stationId].waterTempF = Math.round((val * 9 / 5 + 32) * 10) / 10;
    }
  }

  // Apply temperature proxy fallback: if a Richmond gauge station has null waterTempF
  // (no sensor), substitute the value from the designated proxy station (Cartersville).
  for (const [stationId, proxyId] of Object.entries(TEMP_PROXY_FOR)) {
    const gauge = stationData[stationId];
    if (gauge && gauge.waterTempF === null) {
      gauge.waterTempF = stationData[proxyId]?.waterTempF ?? null;
    }
  }

  // Write one conditions_snapshot row per gauge location.
  // Null gage_ft is valid — it means the USGS API returned no timeseries for that station
  // (e.g. 02037705 is a tidal-stream station without active IV data). The row is still
  // written so ingestion_runs.rows_written reflects both gauges were checked.
  const rows = gaugeLocations
    .filter((loc): loc is typeof loc & { usgs_station_id: string } => Boolean(loc.usgs_station_id))
    .map((loc) => {
      const data = stationData[loc.usgs_station_id] ?? { gageFt: null, dischargeCfs: null, waterTempF: null };
      return {
        location_id: loc.id,
        source: 'usgs',
        payload: json as Json,
        gage_ft: data.gageFt,
        discharge_cfs: data.dischargeCfs,
        water_temp_f: data.waterTempF,
      };
    });

  if (!rows.length) {
    return { ok: true, rowsWritten: 0 };
  }

  const { error } = await supabase.from('conditions_snapshots').insert(rows);
  if (error) return { ok: false, rowsWritten: 0, error: error.message };

  return { ok: true, rowsWritten: rows.length };
}

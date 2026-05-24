import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from './run';

const USER_AGENT = 'rva-james (mike.garrett@teamcolab.com)';
const HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

const GAUGE_ID = 'rmdv2';
const WESTHAM_USGS_STATION = '02037500';

// https://api.water.noaa.gov/nwps/v1/gauges/{id}/stageflow/forecast
// Returns 6-hourly forecast points, typically 12–15 points (~72h lookahead).
const FORECAST_URL = `https://api.water.noaa.gov/nwps/v1/gauges/${GAUGE_ID}/stageflow/forecast`;

// https://api.water.noaa.gov/nwps/v1/gauges/{id}
// Includes flood stage thresholds (action, minor, moderate, major).
const METADATA_URL = `https://api.water.noaa.gov/nwps/v1/gauges/${GAUGE_ID}`;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const ForecastPointSchema = z.object({
  validTime: z.string(),    // ISO-8601 UTC
  generatedTime: z.string(),
  primary: z.number(),      // stage (ft)
  secondary: z.number(),    // flow (kcfs)
});

const ForecastResponseSchema = z.object({
  issuedTime: z.string(),
  primaryName: z.string().optional(),
  primaryUnits: z.string().optional(),
  data: z.array(ForecastPointSchema),
});

const MetadataSchema = z.object({
  flood: z.object({
    categories: z.object({
      action:   z.object({ stage: z.number() }),
      minor:    z.object({ stage: z.number() }),
      moderate: z.object({ stage: z.number() }).optional(),
      major:    z.object({ stage: z.number() }).optional(),
    }),
  }),
});

// ── Public payload type (stored as jsonb, read back by getForecast) ──────────

export interface NoaaAhpsForecastPoint {
  t: number;          // Unix ms
  stage_ft: number;
  flow_kcfs: number;
}

export interface NoaaAhpsPayload {
  issued_at: string;            // ISO-8601 forecast issuance time
  gauge_id: string;             // "rmdv2"
  action_stage_ft: number;      // NWS action stage (9 ft for Richmond)
  flood_stage_ft: number;       // NWS minor flood stage (12 ft for Richmond)
  forecast: NoaaAhpsForecastPoint[];
}

// ── Ingest function ──────────────────────────────────────────────────────────

export async function runNoaaAhpsIngestion(): Promise<RunResult> {
  // Fetch forecast + metadata in parallel
  const [forecastRes, metaRes] = await Promise.all([
    fetch(FORECAST_URL, { headers: HEADERS }),
    fetch(METADATA_URL, { headers: HEADERS }),
  ]);

  if (!forecastRes.ok) {
    throw new Error(`NOAA forecast HTTP ${forecastRes.status}: ${FORECAST_URL}`);
  }
  if (!metaRes.ok) {
    throw new Error(`NOAA metadata HTTP ${metaRes.status}: ${METADATA_URL}`);
  }

  const [forecastJson, metaJson] = await Promise.all([
    forecastRes.json(),
    metaRes.json(),
  ]);

  const forecastData = ForecastResponseSchema.parse(forecastJson);
  const metaData     = MetadataSchema.parse(metaJson);

  const payload: NoaaAhpsPayload = {
    issued_at:         forecastData.issuedTime,
    gauge_id:          GAUGE_ID,
    action_stage_ft:   metaData.flood.categories.action.stage,
    flood_stage_ft:    metaData.flood.categories.minor.stage,
    forecast:          forecastData.data.map((pt) => ({
      t:          new Date(pt.validTime).getTime(),
      stage_ft:   pt.primary,
      flow_kcfs:  pt.secondary,
    })),
  };

  // Look up the Westham gauge location_id (gauge kind, usgs_station_id = 02037500)
  const supabase = await createServerClient('service');
  const { data: gaugeLoc } = await supabase
    .from('locations')
    .select('id')
    .eq('kind', 'gauge')
    .eq('usgs_station_id', WESTHAM_USGS_STATION)
    .single();

  if (!gaugeLoc) {
    throw new Error(`Westham gauge location not found (usgs_station_id=${WESTHAM_USGS_STATION})`);
  }

  const { error } = await supabase
    .from('conditions_snapshots')
    .insert({
      location_id: gaugeLoc.id,
      source:      'noaa-ahps',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload:     payload as any,
    });

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }

  return { ok: true, rowsWritten: 1 };
}

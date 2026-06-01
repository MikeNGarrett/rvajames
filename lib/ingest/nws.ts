import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { RunResult } from './run';
import { USER_AGENT } from './user-agent';

const NWS_HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

// Richmond, VA grid: AKQ office, grid 36,78 (Belle Isle area)
const NWS_HOURLY_URL = 'https://api.weather.gov/gridpoints/AKQ/36,78/forecast/hourly';
// Active alerts for Virginia — we'll filter to James River / Richmond
const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active?area=VA&status=actual';

/**
 * Open-Meteo UV index endpoint — sub-goal 86.
 *
 * NWS does NOT expose UV index in their JSON API (verified 2026-05-31:
 * the gridpoint endpoint has 59 properties, none of them UV). The
 * official NWS UV product is text-only at cpc.ncep.noaa.gov.
 *
 * Open-Meteo is a free, no-auth weather API that publishes hourly UV
 * forecast for any lat/lon. We pull 48h of values aligned to America/
 * New_York so the timestamps match the rest of our Richmond-anchored
 * data.
 *
 * Coords are Belle Isle (~river mid-point). UV index is a regional
 * value at this scale — same value across all 9 access points.
 *
 * Failure path: if Open-Meteo is unreachable, we skip UV but the NWS
 * ingest still completes (with `uv_hourly: null` in the snapshot
 * payload). The happinessIndex rule handles null UV as neutral.
 */
const OPEN_METEO_UV_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=37.54&longitude=-77.43' +
  '&hourly=uv_index' +
  '&timezone=America/New_York' +
  '&forecast_days=2';

const HourlyPeriodSchema = z.object({
  number: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  temperature: z.number(),
  temperatureUnit: z.string(),
  windSpeed: z.string(),
  windDirection: z.string(),
  shortForecast: z.string(),
  probabilityOfPrecipitation: z.object({ value: z.number().nullable() }).optional(),
});

const HourlyForecastSchema = z.object({
  properties: z.object({
    periods: z.array(HourlyPeriodSchema),
  }),
});

// Open-Meteo UV response. Defensive — Open-Meteo is generally reliable
// but their schema can grow new fields; we only consume what we need.
const OpenMeteoUvSchema = z.object({
  hourly: z.object({
    time:     z.array(z.string()),
    uv_index: z.array(z.number().nullable()),
  }),
});

/**
 * Fetch UV index hourly forecast from Open-Meteo. Returns null on any
 * failure — never throws — so the NWS ingest can continue with UV
 * omitted rather than failing the whole cron run.
 */
async function fetchOpenMeteoUv(): Promise<
  Array<{ time: string; uv: number | null }> | null
> {
  try {
    const resp = await fetch(OPEN_METEO_UV_URL, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.warn(`[nws] Open-Meteo UV fetch returned ${resp.status}; skipping UV`);
      return null;
    }
    const json   = await resp.json();
    const parsed = OpenMeteoUvSchema.safeParse(json);
    if (!parsed.success) {
      console.warn('[nws] Open-Meteo UV response failed schema parse; skipping UV');
      return null;
    }
    const { time, uv_index } = parsed.data.hourly;
    // Zip the two parallel arrays into a single records list, slice to
    // the same 24h horizon as the NWS hourly forecast.
    return time.slice(0, 24).map((t, i) => ({
      time: t,
      uv:   uv_index[i] ?? null,
    }));
  } catch (err) {
    console.warn(`[nws] Open-Meteo UV fetch threw; skipping UV: ${String(err)}`);
    return null;
  }
}

const AlertPropertiesSchema = z.object({
  // NWS-supplied unique ID for this alert broadcast — used as source_id for
  // upsert dedup so re-broadcasts of the same active alert produce 0 new rows.
  id: z.string(),
  event: z.string(),
  severity: z.enum(['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown']),
  headline: z.string().nullable(),
  description: z.string().nullable(),
  effective: z.string(),
  expires: z.string().nullable(),
  areaDesc: z.string(),
});

const AlertSchema = z.object({
  properties: AlertPropertiesSchema,
});

const AlertsResponseSchema = z.object({
  features: z.array(AlertSchema),
});

function nwsSeverityToLocal(
  s: string,
): 'low' | 'moderate' | 'high' | 'extreme' {
  switch (s) {
    case 'Extreme': return 'extreme';
    case 'Severe': return 'high';
    case 'Moderate': return 'moderate';
    default: return 'low';
  }
}

function alertKind(event: string): 'flood_watch' | 'flood_warning' | 'flood_advisory' | 'general' {
  const lower = event.toLowerCase();
  if (lower.includes('flood warning')) return 'flood_warning';
  if (lower.includes('flood watch')) return 'flood_watch';
  if (lower.includes('flood advisory')) return 'flood_advisory';
  return 'general';
}

const RICHMOND_KEYWORDS = ['richmond', 'james river', 'chesterfield', 'henrico'];

function isRichmondRelevant(areaDesc: string): boolean {
  const lower = areaDesc.toLowerCase();
  return RICHMOND_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function runNwsIngestion(): Promise<RunResult> {
  const supabase = await createServerClient('service');
  let rowsWritten = 0;

  // --- Hourly forecast snapshot (NWS) + UV (Open-Meteo) in parallel ---
  // Open-Meteo's UV pull is independent of NWS; running them concurrently
  // saves ~300 ms on the cron's total runtime under typical latency.
  const [hourlyResp, uvHourly] = await Promise.all([
    fetch(NWS_HOURLY_URL, {
      headers: NWS_HEADERS,
      signal:  AbortSignal.timeout(15_000),
    }),
    fetchOpenMeteoUv(),
  ]);

  if (hourlyResp.ok) {
    const json = await hourlyResp.json();
    const parsed = HourlyForecastSchema.safeParse(json);
    if (parsed.success) {
      const next24 = parsed.data.properties.periods.slice(0, 24);
      const airTempF = next24[0]?.temperature ?? null;
      const precipPct = next24[0]?.probabilityOfPrecipitation?.value ?? null;

      // Use Belle Isle as the anchor location for NWS forecast
      const { data: belleLoc } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', 'belle-isle')
        .single();

      if (belleLoc) {
        const { error } = await supabase.from('conditions_snapshots').insert({
          location_id: belleLoc.id,
          source: 'nws_hourly',
          // uv_hourly is null when Open-Meteo failed (logged in
          // fetchOpenMeteoUv). Consumers (happinessIndex rule) treat
          // null UV as neutral — no UV penalty applied.
          payload: { periods: next24, uv_hourly: uvHourly } as Json,
          air_temp_f: airTempF,
          precip_in: precipPct !== null ? precipPct / 100 : null,
        });
        if (!error) rowsWritten++;
      }
    }
  }

  // --- Active alerts ---
  const alertsResp = await fetch(NWS_ALERTS_URL, {
    headers: NWS_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });

  if (alertsResp.ok) {
    const json = await alertsResp.json();
    const parsed = AlertsResponseSchema.safeParse(json);
    if (parsed.success) {
      const richmondAlerts = parsed.data.features.filter((f) =>
        isRichmondRelevant(f.properties.areaDesc),
      );

      for (const alert of richmondAlerts) {
        const p = alert.properties;
        const kind = alertKind(p.event);
        const headline = p.headline ?? p.event;

        // Upsert on (source, source_id) — p.id is the NWS-supplied URN that
        // remains stable across re-broadcasts of the same active alert.
        // DO UPDATE means an alert body change is captured on re-broadcast.
        const { error } = await supabase.from('advisories').upsert({
          source:         'nws',
          source_id:      p.id,
          kind,
          severity:       nwsSeverityToLocal(p.severity),
          headline,
          body:           p.description ?? '',
          effective_from: p.effective,
          effective_to:   p.expires ?? null,
          location_ids:   [],
        }, { onConflict: 'source,source_id' });

        if (!error) rowsWritten++;
      }
    }
  }

  return { ok: true, rowsWritten };
}

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
 * Open-Meteo hourly forecast — sub-goals 86 + 90.
 *
 * Why Open-Meteo at all (sub-goal 86 rationale): NWS does NOT expose
 * UV index in their JSON API (verified 2026-05-31: the gridpoint
 * endpoint has 59 properties, none of them UV). The official NWS UV
 * product is text-only.
 *
 * Why MORE fields (sub-goal 90 expansion): the Richmond Conditions
 * rules engine (sub-goal 87) needs:
 *   - apparentTempF (Rothfusz/wind chill) → needs RH + wind speed
 *   - wetBulbF (Stull approximation)      → needs RH
 *   - nextHoursOutlook precip chance      → needs precip probability
 * NWS's /forecast/hourly endpoint has temperature + precip probability
 * but NOT humidity or numeric wind (only a "10 mph" string). Pulling
 * the same fields from Open-Meteo gives us a clean numeric source.
 *
 * Coords are Belle Isle (~river mid-point). All values are regional
 * at this scale — single fetch covers all 9 access points.
 *
 * Failure path: returns null. NWS ingest still completes; consumers
 * handle null per-field as neutral (no UV penalty, can't compute
 * apparent-temp → fall back to ambient, etc.).
 */
const OPEN_METEO_HOURLY_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=37.54&longitude=-77.43' +
  '&hourly=uv_index,relative_humidity_2m,wind_speed_10m,precipitation_probability,temperature_2m' +
  '&temperature_unit=fahrenheit' +
  '&wind_speed_unit=mph' +
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

// Open-Meteo hourly response — sub-goal 90 expanded shape.
// Defensive: Open-Meteo is generally reliable but their schema can grow
// new fields; we only consume what we need.
const OpenMeteoHourlySchema = z.object({
  hourly: z.object({
    time:                       z.array(z.string()),
    uv_index:                   z.array(z.number().nullable()),
    relative_humidity_2m:       z.array(z.number().nullable()),
    wind_speed_10m:             z.array(z.number().nullable()),
    precipitation_probability:  z.array(z.number().nullable()),
    temperature_2m:             z.array(z.number().nullable()),
  }),
});

/** Single hourly record persisted into conditions_snapshots.payload.open_meteo_hourly. */
export interface OpenMeteoHour {
  time:        string;          // local ET ISO ("YYYY-MM-DDTHH:mm")
  uv:          number | null;
  humidityPct: number | null;
  windMph:     number | null;
  precipPct:   number | null;
  ambientF:    number | null;   // cross-check vs NWS temperature
}

/**
 * Fetch hourly weather forecast from Open-Meteo. Returns null on any
 * failure — never throws — so the NWS ingest can continue with the
 * supplemental data omitted rather than failing the whole cron run.
 */
async function fetchOpenMeteoHourly(): Promise<OpenMeteoHour[] | null> {
  try {
    const resp = await fetch(OPEN_METEO_HOURLY_URL, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.warn(`[nws] Open-Meteo fetch returned ${resp.status}; skipping supplemental data`);
      return null;
    }
    const json   = await resp.json();
    const parsed = OpenMeteoHourlySchema.safeParse(json);
    if (!parsed.success) {
      console.warn('[nws] Open-Meteo response failed schema parse; skipping supplemental data');
      return null;
    }
    const h = parsed.data.hourly;
    // Zip parallel arrays into a single records list, slice to the
    // same 24h horizon as the NWS hourly forecast.
    return h.time.slice(0, 24).map((t, i) => ({
      time:        t,
      uv:          h.uv_index[i]                   ?? null,
      humidityPct: h.relative_humidity_2m[i]       ?? null,
      windMph:     h.wind_speed_10m[i]             ?? null,
      precipPct:   h.precipitation_probability[i]  ?? null,
      ambientF:    h.temperature_2m[i]             ?? null,
    }));
  } catch (err) {
    console.warn(`[nws] Open-Meteo fetch threw; skipping supplemental data: ${String(err)}`);
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
  const [hourlyResp, openMeteoHourly] = await Promise.all([
    fetch(NWS_HOURLY_URL, {
      headers: NWS_HEADERS,
      signal:  AbortSignal.timeout(15_000),
    }),
    fetchOpenMeteoHourly(),
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
          // open_meteo_hourly is null when Open-Meteo failed (logged
          // in fetchOpenMeteoHourly). Consumers (happinessIndex,
          // apparent-temp, wet-bulb) handle null gracefully — UV
          // penalty becomes neutral; apparent-temp falls back to
          // ambient; etc.
          payload: { periods: next24, open_meteo_hourly: openMeteoHourly } as Json,
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

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { RunResult } from './run';

const USER_AGENT = 'rva-james (mike.garrett@teamcolab.com)';
const NWS_HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

// Richmond, VA grid: AKQ office, grid 36,78 (Belle Isle area)
const NWS_HOURLY_URL = 'https://api.weather.gov/gridpoints/AKQ/36,78/forecast/hourly';
// Active alerts for Virginia — we'll filter to James River / Richmond
const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active?area=VA&status=actual';

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

const AlertPropertiesSchema = z.object({
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

  // --- Hourly forecast snapshot ---
  const hourlyResp = await fetch(NWS_HOURLY_URL, {
    headers: NWS_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });

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
          payload: { periods: next24 } as Json,
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
        const { error } = await supabase.from('advisories').insert({
          source: 'nws',
          kind: alertKind(p.event),
          severity: nwsSeverityToLocal(p.severity),
          headline: p.headline ?? p.event,
          body: p.description ?? '',
          effective_from: p.effective,
          effective_to: p.expires ?? null,
          location_ids: [],
        });
        if (!error) rowsWritten++;
      }
    }
  }

  return { ok: true, rowsWritten };
}

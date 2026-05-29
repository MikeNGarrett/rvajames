import { z } from 'zod';

// ─── Output schema (zod mirrors the JSON schema in system-prompt.ts) ─────────

export const ActivityStatusSchema = z.object({
  slug: z.string(),
  status: z.enum(['safe', 'caution', 'deny']),
  note: z.string(),
});

export const InterpretationSchema = z.object({
  status: z.enum(['safe', 'caution', 'danger', 'flood']),
  headline: z.string(),
  body_md: z.string(),
  activities: z.array(ActivityStatusSchema),
  prep_items: z.array(z.string()),
  attribution: z.array(z.string()),
});

export type Interpretation = z.infer<typeof InterpretationSchema>;

// ─── Water quality input types ────────────────────────────────────────────────

export type WqFreshness = 'current' | 'recent' | 'stale';

/** Freshness label derived from days since collection. */
export function computeWqFreshness(daysOld: number): WqFreshness {
  if (daysOld < 7) return 'current';
  if (daysOld <= 14) return 'recent';
  return 'stale';
}

/** Per-call water quality data for the primary (nearest) JRA station. */
export interface WaterQualityStationInput {
  stationCode: string;
  stationName: string;
  /** E. coli in CFU/100mL, or null if not measured in this sample. */
  ecoliCfuPer100ml: number | null;
  /**
   * Enterococcus in CFU/100mL; always null for all current JRA Richmond-reach
   * stations — all 9 tested stations are E. coli–only (verified 2026-05-25).
   */
  enterococciCfuPer100ml: number | null;
  /** Whole days since the sample was collected. */
  daysOld: number;
  freshness: WqFreshness;
  /** True when the station methodology includes enterococcus. Currently always false. */
  testsEnterococcus: boolean;
}

/** Per-call water quality data for an upstream watch station (typically J24). */
export interface WaterQualityWatchInput {
  stationCode: string;
  stationName: string;
  ecoliCfuPer100ml: number | null;
  daysOld: number;
  freshness: WqFreshness;
}

/**
 * Full water quality block for the AI per-call input.
 * null = no JRA station is mapped to this access point (gauge slugs, pipeline-trail).
 */
export interface WaterQualityInput {
  /** Nearest JRA station; null when no reading exists within the recency window. */
  primaryStation: WaterQualityStationInput | null;
  /** Upstream watch reading (J24 Huguenot Flatwater for most downtown points). */
  watchStation: WaterQualityWatchInput | null;
}

// ─── Per-call input ───────────────────────────────────────────────────────────

export interface InterpretLocationInput {
  date: string;               // YYYY-MM-DD
  locationSlug: string;
  locationName: string;
  ageBucket: '0-2' | '3-5' | '6-9' | '10-13' | '14+' | 'none';
  /** 'observed' for today (live gauge data); 'forecast' for days +1..+3. */
  mode: 'observed' | 'forecast';
  /** Forecast confidence band; null when mode is 'observed'. */
  forecastConfidence: 'high' | 'medium' | 'low' | null;
  /** Calendar days from today. 0 = today (observed). */
  daysOut: number;
  gageFt: number | null;
  dischargeCfs: number | null;
  waterTempF: number | null;
  airTempF: number | null;
  precip24hIn: number | null;
  dataAgeMinutes: number | null;
  activeAdvisoryHeadlines: string[];
  availableActivitySlugs: string[];
  /**
   * James River Watch bacterial data for this location's mapped station(s).
   * null = no JRA station mapping (gauge slugs, pipeline-trail).
   * Non-null with primaryStation=null = station mapped but no recent reading.
   */
  waterQuality: WaterQualityInput | null;
  /**
   * Upstream CSO signal for this location.
   * null = no active CSO events upstream in the past 48 h (count === 0).
   * Non-null = one or more outfalls discharged upstream within the window.
   */
  upstreamCso: {
    count: number;
    mostRecentAt: string | null;
    outfalls: Array<{
      name: string;
      csoOccurredAt: string;
      hoursAgo: number;
    }>;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralDays(n: number): string {
  return `${n} day${n !== 1 ? 's' : ''}`;
}

export function buildUserMessage(input: InterpretLocationInput): string {
  const isForecast = input.mode === 'forecast';
  const modeLabel = isForecast
    ? `forecast (${input.forecastConfidence ?? 'unknown'} confidence, day +${input.daysOut})`
    : 'observed';
  const conditionsHeader = isForecast
    ? `--- Forecast conditions (day +${input.daysOut}) ---`
    : '--- Current conditions ---';

  const lines: string[] = [
    `Date: ${input.date}`,
    `Mode: ${modeLabel}`,
    `Location: ${input.locationName} (${input.locationSlug})`,
    `Age context: ${input.ageBucket === 'none' ? 'General audience — no children (adult visitors only)' : `Youngest family member: ${input.ageBucket}`}`,
    '',
    conditionsHeader,
    `Gage height: ${input.gageFt !== null ? `${input.gageFt} ft` : 'unavailable'}`,
    `Discharge: ${input.dischargeCfs !== null ? `${input.dischargeCfs} cfs` : 'unavailable'}`,
    // Water temperature is absent from AHPS forecast payloads; only emit for observed mode.
    ...(isForecast ? [] : [`Water temp: ${input.waterTempF !== null ? `${input.waterTempF}°F` : 'unavailable'}`]),
    `Air temp: ${input.airTempF !== null ? `${input.airTempF}°F` : 'unavailable'}`,
    `Precipitation last 24h: ${input.precip24hIn !== null ? `${input.precip24hIn} in` : 'unavailable'}`,
    // Data age only meaningful for observed (live snapshot); forecast data has no age.
    ...(isForecast ? [] : [`Data age: ${input.dataAgeMinutes !== null ? `${input.dataAgeMinutes} minutes` : 'unknown'}`]),
    '',
    '--- Active advisories ---',
    input.activeAdvisoryHeadlines.length
      ? input.activeAdvisoryHeadlines.map((h) => `• ${h}`).join('\n')
      : 'None',
    '',
    '--- Activities available at this location ---',
    input.availableActivitySlugs.join(', '),
  ];

  // ── Water quality block ────────────────────────────────────────────────────
  lines.push('');
  lines.push('--- Water quality (James River Watch) ---');

  if (input.waterQuality === null) {
    lines.push('No JRA station mapped for this location.');
  } else {
    const { primaryStation, watchStation } = input.waterQuality;

    if (!primaryStation) {
      lines.push('Primary station: no sample within the 14-day recency window (out of season or data unavailable).');
    } else {
      const { stationCode, stationName, ecoliCfuPer100ml, enterococciCfuPer100ml, daysOld, freshness, testsEnterococcus } = primaryStation;
      lines.push(`Primary station: ${stationName} (${stationCode})`);
      lines.push(`  E. coli: ${ecoliCfuPer100ml !== null ? `${ecoliCfuPer100ml} CFU/100mL` : 'not measured in this sample'}`);
      if (testsEnterococcus) {
        lines.push(`  Enterococcus: ${enterococciCfuPer100ml !== null ? `${enterococciCfuPer100ml} CFU/100mL` : 'not measured in this sample'}`);
      } else {
        lines.push(`  Enterococcus: not tested (E. coli–only station)`);
      }
      lines.push(`  Sample age: ${pluralDays(daysOld)} (${freshness})`);
    }

    if (watchStation) {
      const { stationCode, stationName, ecoliCfuPer100ml, daysOld, freshness } = watchStation;
      const ecoliStr = ecoliCfuPer100ml !== null ? `${ecoliCfuPer100ml} CFU/100mL` : 'no reading';
      lines.push(`Watch station: ${stationName} (${stationCode}) — ${ecoliStr}, ${pluralDays(daysOld)} old (${freshness})`);
    }
  }

  // ── Upstream CSO block ─────────────────────────────────────────────────────
  lines.push('');
  lines.push('--- Upstream CSO (combined sewer overflow) ---');

  const cso = input.upstreamCso;
  if (!cso || cso.count === 0) {
    lines.push('Upstream CSO: no active events in past 48h.');
  } else {
    const first3 = cso.outfalls.slice(0, 3);
    lines.push(`Upstream CSO: ${cso.count} active event(s) in past 48h.`);
    lines.push(`Most recent: ${first3[0].name} ~${first3[0].hoursAgo}h ago.`);
    if (first3.length > 1) {
      lines.push(
        `Also active: ${first3
          .slice(1)
          .map((o) => `${o.name} ~${o.hoursAgo}h ago`)
          .join(', ')}.`,
      );
    }
    lines.push('Bacteria likely elevated; caution for swim/wade.');
  }

  lines.push('');
  lines.push('Respond with a single JSON object matching the schema in the system prompt.');

  return lines.join('\n');
}

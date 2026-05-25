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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralDays(n: number): string {
  return `${n} day${n !== 1 ? 's' : ''}`;
}

export function buildUserMessage(input: InterpretLocationInput): string {
  const lines: string[] = [
    `Date: ${input.date}`,
    `Location: ${input.locationName} (${input.locationSlug})`,
    `Age context: ${input.ageBucket === 'none' ? 'General audience — no children (adult visitors only)' : `Youngest family member: ${input.ageBucket}`}`,
    '',
    '--- Current conditions ---',
    `Gage height: ${input.gageFt !== null ? `${input.gageFt} ft` : 'unavailable'}`,
    `Discharge: ${input.dischargeCfs !== null ? `${input.dischargeCfs} cfs` : 'unavailable'}`,
    `Water temp: ${input.waterTempF !== null ? `${input.waterTempF}°F` : 'unavailable'}`,
    `Air temp: ${input.airTempF !== null ? `${input.airTempF}°F` : 'unavailable'}`,
    `Precipitation last 24h: ${input.precip24hIn !== null ? `${input.precip24hIn} in` : 'unavailable'}`,
    `Data age: ${input.dataAgeMinutes !== null ? `${input.dataAgeMinutes} minutes` : 'unknown'}`,
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

  lines.push('');
  lines.push('Respond with a single JSON object matching the schema in the system prompt.');

  return lines.join('\n');
}

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
    '',
    'Respond with a single JSON object matching the schema in the system prompt.',
  ];

  return lines.join('\n');
}

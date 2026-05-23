import { z } from 'zod';
import type { AgeBucket } from '@/lib/url-state';
import type { MetroRiverState } from '@/lib/queries/river-segment';

// ─── Output schema ────────────────────────────────────────────────────────────

export const BestBetSchema = z.object({
  location_slug: z.string(),
  reason: z.string(), // ≤ 12 words
});

export const MetroSummarySchema = z.object({
  headline: z.string(),         // 1 sentence, ≤ 90 chars
  body_md: z.string(),          // 2–3 paragraphs, brand voice, Markdown
  top_concerns: z.array(z.string()).max(3),  // ≤ 3 brief concerns; empty if none
  best_bets_today: z.array(BestBetSchema).max(3),  // ≤ 3 top locations
  disclaimer_kind: z.enum(['standard', 'children', 'general_audience']),
});

export type MetroSummary = z.infer<typeof MetroSummarySchema>;

// ─── Input / user message builder ────────────────────────────────────────────

export interface MetroSummaryInput {
  date: string;         // YYYY-MM-DD
  ageBucket: AgeBucket;
  metroState: MetroRiverState;
  activeAdvisoryHeadlines: string[];
  airTempF: number | null;
}

export function buildMetroUserMessage(input: MetroSummaryInput): string {
  const { upriver, downriver } = input.metroState;

  const lines: string[] = [
    `Date: ${input.date}`,
    `Age context: ${
      input.ageBucket === 'none'
        ? 'General audience — adult visitors, no children specified'
        : `Youngest family member: ${input.ageBucket}`
    }`,
    '',
    '--- Metro river state ---',
    `Westham upriver gauge (02037500) — gage height (arbitrary datum): ${
      upriver.gageFt !== null ? `${upriver.gageFt} ft` : 'unavailable'
    }`,
    `Westham discharge: ${
      upriver.dischargeCfs !== null ? `${upriver.dischargeCfs.toLocaleString()} cfs` : 'unavailable'
    }`,
    `Westham water temp: ${
      upriver.waterTempF !== null ? `${upriver.waterTempF}°F` : 'unavailable'
    }`,
    `City Locks tidal station (02037705) — water surface elev. above NAVD 1988: ${
      downriver.gageFt !== null ? `${downriver.gageFt} ft NAVD` : 'unavailable'
    }`,
    `Data age: ${
      input.metroState.lastUpdatedAt
        ? `${Math.round((Date.now() - new Date(input.metroState.lastUpdatedAt).getTime()) / 60_000)}m ago`
        : 'unknown'
    }`,
    '',
    '--- Weather ---',
    `Air temperature: ${input.airTempF !== null ? `${input.airTempF}°F` : 'unavailable'}`,
    '',
    '--- Active advisories ---',
    input.activeAdvisoryHeadlines.length
      ? input.activeAdvisoryHeadlines.map((h) => `• ${h}`).join('\n')
      : 'None',
    '',
    'Produce a metro-level river summary for Richmond families planning a James River visit today.',
    'Respond with a single JSON object matching the metro summary schema in the system prompt.',
  ];

  return lines.join('\n');
}

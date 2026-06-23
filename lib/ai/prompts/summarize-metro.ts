import { z } from 'zod';
import type { AgeBucket } from '@/lib/url-state';
import type { MetroRiverState } from '@/lib/queries/river-segment';
import { rapidsClass, riverWideActivityStatuses } from '@/lib/safety/rules';

// ─── Activity grid schema ─────────────────────────────────────────────────────

export const ACTIVITY_SLUGS_RIVERWIDE = [
  'swimming',
  'rock-hopping',
  'kayaking-whitewater',
  'hiking',
] as const;

export type RiverwideActivitySlug = (typeof ACTIVITY_SLUGS_RIVERWIDE)[number];

const ActivityStatusSchema = z.object({
  slug:   z.enum(ACTIVITY_SLUGS_RIVERWIDE),
  status: z.enum(['safe', 'caution', 'deny']),
  note:   z.string().max(120), // ≤ 12 words in plain language
});

// ─── Rapids class schema ──────────────────────────────────────────────────────

export const RAPIDS_CLASSES = ['I-II', 'II-III', 'III-IV', 'IV-V'] as const;
export type RapidsClass = (typeof RAPIDS_CLASSES)[number];

// ─── Shared fields (both schemas) ────────────────────────────────────────────

// SEC-4: location_slug is AI output that gets serialized into an inline
// speculation-rules <script> (MetroSummaryPanel). Constrain it to the same
// kebab-case pattern the API routes enforce so a prompt-injected
// "</script>…" value can never reach a script context. The character class
// excludes everything needed to break out of (or escape within) the tag.
export const LOCATION_SLUG_PATTERN = /^[a-z0-9-]{2,64}$/;

const BaseMetroSummarySchema = z.object({
  headline:      z.string(),                    // 1 sentence, ≤ 90 chars
  body_md:       z.string(),                    // 2–3 paragraphs, brand voice, Markdown
  top_concerns:  z.array(z.string()).max(3),    // ≤ 3 brief concerns; empty if none
  best_bets_today: z.array(
    z.object({ location_slug: z.string().regex(LOCATION_SLUG_PATTERN), reason: z.string() }),
  ).max(3),
  disclaimer_kind: z.enum(['standard', 'children', 'general_audience']),
});

// ─── Write schema — used to validate fresh AI output ─────────────────────────
// b2 fields (activities, rapids_class, rapids_note) are required — they've
// been in the prompt long enough that the model reliably includes them.
//
// b3 richmond_microcopy is OPTIONAL on writes (sub-goal 91 hotfix, 2026-06-02).
// Live testing showed the model omits it on ~30% of fresh generations,
// which would otherwise cascade to a 502 every time. The system prompt
// still asks for it; we just don't fail the whole response when it's missing.
// When present, it gets persisted + rendered; when absent, the UI shows
// only the deterministic headline + tiles. Graceful degrade.

export const MetroSummaryWriteSchema = BaseMetroSummarySchema.extend({
  activities:   z.array(ActivityStatusSchema).length(4),
  rapids_class: z.enum(RAPIDS_CLASSES),
  rapids_note:  z.string().max(150), // ≤ 15 words
  // 1–2 sentences for the Richmond Conditions section microcopy.
  // 20-180 chars constrains it to one or two short, conversational
  // sentences. Optional on writes per the note above.
  richmond_microcopy: z.string().min(20).max(180).optional(),
});

// ─── Read schema (lenient) — used when reading cached rows ───────────────────
// Pre-b2/b3 rows have NULL for these columns; treat them as absent.

export const MetroSummarySchema = BaseMetroSummarySchema.extend({
  activities:         z.array(ActivityStatusSchema).length(4).optional(),
  rapids_class:       z.enum(RAPIDS_CLASSES).optional(),
  rapids_note:        z.string().max(150).optional(),
  richmond_microcopy: z.string().min(20).max(180).optional(),
});

export type MetroSummary = z.infer<typeof MetroSummarySchema>;

// ─── Prompt version ───────────────────────────────────────────────────────────
// Bump this constant whenever Schema B changes. It enters the prompt_hash so that
// all pre-existing metro_summaries rows are orphaned (hash never matches again).
//
// b2 → b3 (2026-06-02): added richmond_microcopy field for the new
// Richmond Conditions section. Migration 0015 adds the nullable column.

export const PROMPT_VERSION = 'b4' as const;

// ─── Input / user message builder ────────────────────────────────────────────

export interface ActiveClosureEntry {
  locationSlug: string;
  kind:         'open' | 'restricted' | 'closed' | 'closed_indefinite';
  reason:       string;
}

export interface MetroSummaryInput {
  date:                    string;       // YYYY-MM-DD
  ageBucket:               AgeBucket;
  metroState:              MetroRiverState;
  activeAdvisoryHeadlines: string[];
  /**
   * Deterministic severe-weather gate (NWS watches/warnings) from
   * severeWeatherStatus(). When tier is 'watch'/'warning' the model is directed
   * to suppress activity recommendations and lead with the safety message.
   */
  severeWeather?:          { tier: 'none' | 'watch' | 'warning'; message: string };
  airTempF:                number | null;
  /** 'observed' for today (live gauge data); 'forecast' for days +1..+3. */
  mode:                    'observed' | 'forecast';
  /** Forecast confidence band; null when mode is 'observed'. */
  forecastConfidence:      'high' | 'medium' | 'low' | null;
  /** Calendar days from today. 0 = today (observed). */
  daysOut:                 number;
  // Optional: pre-computed deterministic signals (injected in sub-goal 31)
  rain48hIn?:              number;
  activeCSOAdvisory?:      boolean;
  hasHighSeverityAdvisory?: boolean;
  /**
   * Active operational closures / restrictions. Included in the user message
   * so the AI avoids recommending closed locations in best_bets_today.
   * Changes naturally invalidate the prompt_hash, forcing regeneration.
   */
  activeClosures?:         ActiveClosureEntry[];
  /**
   * CSO (combined sewer overflow) state — count-only, no outfall IDs.
   * Replaces the former `activeCsoOutfalls` array (removed in sub-goal 96).
   * `activelyDischarging.count` = outfalls with current_overflow=true.
   * `advisoriesOnSelectedDate` = advisory windows covering today.
   */
  cso?: {
    activelyDischarging:       { count: number };
    advisoriesOnSelectedDate:  { count: number; windowEndsAt: string | null };
  };
}

export function buildMetroUserMessage(input: MetroSummaryInput): string {
  const { upriver, downriver } = input.metroState;

  // Compute deterministic baselines from rules engine
  const upriverGageFt   = upriver.gageFt ?? 3.0;   // fallback to normal if unknown
  const rain48hIn       = input.rain48hIn ?? 0;
  const activeCSOAdvisory      = input.activeCSOAdvisory ?? false;
  const hasHighSeverityAdvisory = input.hasHighSeverityAdvisory ?? false;

  const classResult    = rapidsClass(upriverGageFt);
  const activityBaseline = riverWideActivityStatuses({
    upriverGageFt,
    waterTempF:             upriver.waterTempF ?? null,
    rain48hIn,
    activeCSOAdvisory,
    hasHighSeverityAdvisory,
  });

  const isForecast = input.mode === 'forecast';
  const modeLabel = isForecast
    ? `forecast (${input.forecastConfidence ?? 'unknown'} confidence, day +${input.daysOut})`
    : 'observed';

  const lines: string[] = [
    `Date: ${input.date}`,
    `Mode: ${modeLabel}`,
    `Prompt version: ${PROMPT_VERSION}`,
    `Age context: ${
      input.ageBucket === 'none'
        ? 'General audience — adult visitors, no children specified'
        : `Youngest family member: ${input.ageBucket}`
    }`,
    '',
    ...(input.severeWeather && input.severeWeather.tier !== 'none'
      ? [
          `--- SEVERE WEATHER (deterministic safety gate, tier: ${input.severeWeather.tier}) ---`,
          input.severeWeather.message,
          'DIRECTIVE: This overrides everything below. Do NOT recommend any outdoor or water activities or best-bet locations. Lead with this safety message and frame today as unsafe to be at the river regardless of gage or temperature.',
          '',
        ]
      : []),
    '--- Metro river state ---',
    `Westham upriver gauge (02037500) — gage height (arbitrary datum): ${
      upriver.gageFt !== null ? `${upriver.gageFt} ft` : 'unavailable'
    }`,
    `Westham discharge: ${
      upriver.dischargeCfs !== null ? `${upriver.dischargeCfs.toLocaleString()} cfs` : 'unavailable'
    }`,
    // Water temperature absent from AHPS forecast payload — only emit for observed mode.
    ...(isForecast
      ? []
      : [`Westham water temp: ${upriver.waterTempF !== null ? `${upriver.waterTempF}°F` : 'unavailable'}`]
    ),
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
    `Rain last 48h: ${rain48hIn > 0 ? `${rain48hIn.toFixed(2)}"` : 'none reported'}`,
    `Active CSO overflow advisory: ${activeCSOAdvisory ? 'YES' : 'no'}`,
    '',
    '--- Active advisories ---',
    input.activeAdvisoryHeadlines.length
      ? input.activeAdvisoryHeadlines.map((h) => `• ${h}`).join('\n')
      : 'None',
    '',
    '--- Operational closures & restrictions ---',
    ...(input.activeClosures && input.activeClosures.length > 0
      ? [
          ...input.activeClosures.map(
            (c) => `• ${c.locationSlug} [${c.kind}]: ${c.reason}`,
          ),
          'IMPORTANT: Do not include any closed/restricted locations above in best_bets_today.',
        ]
      : ['None active']),
    '',
    '--- Deterministic baselines (copy slug + status verbatim; write note in your own words) ---',
    `rapids_class: ${classResult.class}  (rules engine: ${classResult.label})`,
    'riverwide_activity_baseline:',
    ...activityBaseline.map(
      (a) => `  { slug: "${a.slug}", status: "${a.status}", baseReason: "${a.baseReason}" }`,
    ),
    '',
    '--- CSO (combined sewer overflow) state ---',
  ];

  // Count-only CSO context — outfall IDs are never surfaced in this prompt.
  // For observed mode: report active overflows + advisory windows covering today.
  // For forecast mode: the signal reflects advisory window coverage on the selected
  // date (not current active discharges), so framing uses future-conditional tense.
  const cso = input.cso;
  const discharging = cso?.activelyDischarging.count ?? 0;
  const advisory    = cso?.advisoriesOnSelectedDate.count ?? 0;
  if (discharging === 0 && advisory === 0) {
    lines.push('CSO state: no active overflows, no advisory windows in effect.');
  } else if (isForecast) {
    const windowEnd = cso?.advisoriesOnSelectedDate.windowEndsAt;
    lines.push(`CSO state: ${advisory} advisory window${advisory !== 1 ? 's' : ''} cover the selected date.`);
    if (windowEnd) {
      lines.push(`Advisory window${advisory !== 1 ? 's' : ''} clear by: ${windowEnd}.`);
    }
    lines.push('Caution for all downstream swimming access points on the selected date.');
  } else {
    lines.push(`CSO state: ${discharging} overflow${discharging !== 1 ? 's' : ''} active in Richmond metro.`);
    if (advisory > 0) {
      lines.push(`Advisory windows covering today: ${advisory}.`);
      const windowEnd = cso?.advisoriesOnSelectedDate.windowEndsAt;
      if (windowEnd) {
        lines.push(`Latest advisory window ends: ${windowEnd}.`);
      }
    }
    lines.push('Caution for all downstream swimming access points.');
  }

  lines.push(
    '',
    'Produce a metro-level river summary for Richmond families planning a James River visit today.',
    'Respond with a single JSON object matching SCHEMA B (prompt version b3) in the system prompt.',
    'The activities[] array must have EXACTLY 4 entries (same order as the baseline above).',
    `Copy rapids_class: "${classResult.class}" verbatim. Do not derive your own class.`,
    'Include richmond_microcopy: 1–2 sentences (20–180 chars total) of plain-language',
    'context for the Richmond Conditions section — see SCHEMA B RULES — Richmond Microcopy',
    'in the system prompt for tone and content guidance.',
  );

  return lines.join('\n');
}

/**
 * Lazy AI generation helper.
 * Cache-first: checks Supabase for an existing result keyed by prompt_hash.
 * On a miss, calls Anthropic and persists the result.
 * Handles concurrent-write races via UNIQUE conflict → SELECT winner.
 * Stale-while-revalidate: returns the most recent prior row on API failure.
 *
 * Supports kind: 'location' (per-location detail interpretation)
 *            and kind: 'metro'  (homepage metro river summary).
 */

import crypto from 'crypto';
import { getAiClient, MODELS } from './client';
import { SYSTEM_PROMPT } from './system-prompt';
import {
  buildUserMessage,
  InterpretationSchema,
  type InterpretLocationInput,
  type Interpretation,
} from './prompts/interpret-location';
import {
  buildMetroUserMessage,
  MetroSummaryWriteSchema,
  PROMPT_VERSION,
  type MetroSummaryInput,
  type MetroSummary,
} from './prompts/summarize-metro';
import { createServerClient } from '@/lib/supabase/server';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgeBucket = '0-2' | '3-5' | '6-9' | '10-13' | '14+' | 'none';

export type GenerationSource = 'cache' | 'generated' | 'stale';

export interface GetOrGenerateLocationResult {
  kind: 'location';
  interpretation: Interpretation;
  source: GenerationSource;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  cacheCreated: number;
  cacheRead: number;
  model: string;
}

export interface GetOrGenerateMetroResult {
  kind: 'metro';
  summary: MetroSummary;
  source: GenerationSource;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  cacheCreated: number;
  cacheRead: number;
  model: string;
}

export type GetOrGenerateResult = GetOrGenerateLocationResult | GetOrGenerateMetroResult;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function computeHash(normalized: string): string {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function computeLocationHash(input: InterpretLocationInput): string {
  return computeHash(JSON.stringify({
    date: input.date,
    locationSlug: input.locationSlug,
    ageBucket: input.ageBucket,
    gageFt: input.gageFt,
    dischargeCfs: input.dischargeCfs,
    waterTempF: input.waterTempF,
    airTempF: input.airTempF,
    precip24hIn: input.precip24hIn,
    advisories: [...input.activeAdvisoryHeadlines].sort(),
    // Water quality changes (new reading, stale→current) trigger regeneration.
    waterQuality: input.waterQuality ?? null,
  }));
}

function computeMetroHash(input: MetroSummaryInput): string {
  return computeHash(JSON.stringify({
    promptVersion: PROMPT_VERSION,        // bump orphans all pre-b2 cached rows
    date: input.date,
    ageBucket: input.ageBucket,
    upriverGageFt: input.metroState.upriver.gageFt,
    upriverDischargeCfs: input.metroState.upriver.dischargeCfs,
    upriverWaterTempF: input.metroState.upriver.waterTempF,
    downriverGageFt: input.metroState.downriver.gageFt,
    airTempF: input.airTempF,
    rain48hIn: input.rain48hIn ?? 0,
    activeCSOAdvisory: input.activeCSOAdvisory ?? false,
    advisories: [...input.activeAdvisoryHeadlines].sort(),
    // Closure changes naturally invalidate the cache — no manual version bump needed
    closures: (input.activeClosures ?? [])
      .map((c) => `${c.locationSlug}:${c.kind}`)
      .sort(),
  }));
}

function estimateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  cacheRead: number,
): number {
  if (model.includes('haiku')) {
    return (
      (tokensIn - cacheRead) * 0.8 / 1_000_000 +
      cacheRead * 0.08 / 1_000_000 +
      tokensOut * 4.0 / 1_000_000
    );
  }
  // Sonnet
  return (
    (tokensIn - cacheRead) * 3.0 / 1_000_000 +
    cacheRead * 0.3 / 1_000_000 +
    tokensOut * 15.0 / 1_000_000
  );
}

function parseJson<T>(text: string): T {
  const jsonText = text
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  return JSON.parse(jsonText) as T;
}

// ─── Location interpretation ───────────────────────────────────────────────────

export async function getOrGenerate(
  input: InterpretLocationInput,
  locationId: string,
  hasHighSeverityAdvisory: boolean,
): Promise<GetOrGenerateLocationResult | null> {
  const supabase = await createServerClient('service');
  const promptHash = computeLocationHash(input);
  const model = hasHighSeverityAdvisory ? MODELS.escalated : MODELS.default;

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  const { data: exact } = await supabase
    .from('ai_interpretations')
    .select('body_md, tokens_in, tokens_out, cost_usd, model')
    .eq('date', input.date)
    .eq('location_id', locationId)
    .eq('age_bucket', input.ageBucket)
    .eq('prompt_hash', promptHash)
    .maybeSingle();

  if (exact) {
    try {
      return {
        kind: 'location',
        interpretation: InterpretationSchema.parse(parseJson(exact.body_md)),
        source: 'cache',
        tokensIn: exact.tokens_in,
        tokensOut: exact.tokens_out,
        costUsd: exact.cost_usd,
        cacheCreated: 0,
        cacheRead: 0,
        model: exact.model,
      };
    } catch (parseErr) {
      // Legacy row with incompatible body_md format — fall through to regenerate.
      console.error('[get-or-generate] cache parse failed for', input.locationSlug, parseErr);
    }
  }

  // ── 2. Generate ──────────────────────────────────────────────────────────
  try {
    const ai = await getAiClient();
    const response = await ai.messages.create({
      model,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserMessage(input) }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const interpretation = InterpretationSchema.parse(parseJson(rawText));
    const usage = response.usage as {
      input_tokens: number; output_tokens: number;
      cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
    };
    const tokensIn = usage.input_tokens;
    const tokensOut = usage.output_tokens;
    const cacheCreated = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const costUsd = estimateCost(model, tokensIn, tokensOut, cacheRead);

    // ── 3. Persist with race handling ────────────────────────────────────
    const { error: insertErr } = await supabase.from('ai_interpretations').insert({
      date: input.date,
      location_id: locationId,
      age_bucket: input.ageBucket,
      model,
      prompt_hash: promptHash,
      body_md: JSON.stringify(interpretation),
      prep_items: interpretation.prep_items as unknown as string[],
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
    });

    if (insertErr) {
      const { data: winner } = await supabase
        .from('ai_interpretations')
        .select('body_md, tokens_in, tokens_out, cost_usd, model')
        .eq('date', input.date)
        .eq('location_id', locationId)
        .eq('age_bucket', input.ageBucket)
        .eq('prompt_hash', promptHash)
        .maybeSingle();
      if (winner) {
        try {
          return {
            kind: 'location',
            interpretation: InterpretationSchema.parse(parseJson(winner.body_md)),
            source: 'cache',
            tokensIn: winner.tokens_in,
            tokensOut: winner.tokens_out,
            costUsd: winner.cost_usd,
            cacheCreated: 0,
            cacheRead: 0,
            model: winner.model,
          };
        } catch {
          // winner row also has legacy format — return the freshly generated result instead
        }
      }
    }

    return { kind: 'location', interpretation, source: 'generated', tokensIn, tokensOut, costUsd, cacheCreated, cacheRead, model };
  } catch {
    // ── 4. Stale-while-revalidate ────────────────────────────────────────
    const { data: stale } = await supabase
      .from('ai_interpretations')
      .select('body_md, tokens_in, tokens_out, cost_usd, model')
      .eq('location_id', locationId)
      .eq('age_bucket', input.ageBucket)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stale) {
      try {
        return {
          kind: 'location',
          interpretation: InterpretationSchema.parse(parseJson(stale.body_md)),
          source: 'stale',
          tokensIn: stale.tokens_in,
          tokensOut: stale.tokens_out,
          costUsd: stale.cost_usd,
          cacheCreated: 0,
          cacheRead: 0,
          model: stale.model,
        };
      } catch {
        // stale row also has legacy format — return null and let the next request regenerate
      }
    }
    return null;
  }
}

// ─── Metro summary ─────────────────────────────────────────────────────────────

export async function getOrGenerateMetro(
  input: MetroSummaryInput,
  hasHighSeverityAdvisory: boolean,
): Promise<GetOrGenerateMetroResult | null> {
  const supabase = await createServerClient('service');
  const promptHash = computeMetroHash(input);
  const model = hasHighSeverityAdvisory ? MODELS.escalated : MODELS.default;

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  const { data: exact } = await supabase
    .from('metro_summaries')
    .select('body_md, headline, top_concerns, best_bets, activities, rapids_class, rapids_note, tokens_in, tokens_out, cost_usd, model')
    .eq('date', input.date)
    .eq('age_bucket', input.ageBucket)
    .eq('prompt_hash', promptHash)
    .maybeSingle();

  if (exact) {
    // metro_summaries stores structured columns; spread new b2 fields only when non-null.
    try {
      const summary: MetroSummary = {
        headline:        exact.headline,
        body_md:         exact.body_md,
        top_concerns:    exact.top_concerns as string[],
        best_bets_today: exact.best_bets as MetroSummary['best_bets_today'],
        disclaimer_kind: 'standard',
        // New b2 fields — null for pre-b2 rows, treated as absent by MetroSummaryReadSchema
        ...(exact.activities   != null && { activities:   exact.activities   as MetroSummary['activities'] }),
        ...(exact.rapids_class != null && { rapids_class: exact.rapids_class as MetroSummary['rapids_class'] }),
        ...(exact.rapids_note  != null && { rapids_note:  exact.rapids_note }),
      };
      return {
        kind: 'metro',
        summary,
        source: 'cache',
        tokensIn: exact.tokens_in,
        tokensOut: exact.tokens_out,
        costUsd: exact.cost_usd,
        cacheCreated: 0,
        cacheRead: 0,
        model: exact.model,
      };
    } catch (parseErr) {
      console.error('[get-or-generate] metro cache parse failed', parseErr);
      // fall through to regenerate
    }
  }

  // ── 2. Generate ──────────────────────────────────────────────────────────
  try {
    const ai = await getAiClient();
    const response = await ai.messages.create({
      model,
      max_tokens: 1500,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildMetroUserMessage(input) }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    // Strict validation — all b2 fields (activities, rapids_class, rapids_note) are required.
    // If the AI omits them, this throws and the page renders without a metro summary.
    const summary = MetroSummaryWriteSchema.parse(parseJson(rawText));
    const usage = response.usage as {
      input_tokens: number; output_tokens: number;
      cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
    };
    const tokensIn = usage.input_tokens;
    const tokensOut = usage.output_tokens;
    const cacheCreated = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const costUsd = estimateCost(model, tokensIn, tokensOut, cacheRead);

    // ── 3. Persist with race handling ────────────────────────────────────
    const { error: insertErr } = await supabase.from('metro_summaries').insert({
      date:         input.date,
      age_bucket:   input.ageBucket,
      model,
      prompt_hash:  promptHash,
      headline:     summary.headline,
      body_md:      summary.body_md,
      top_concerns: summary.top_concerns as unknown as string[],
      best_bets:    summary.best_bets_today as unknown as string[],
      // b2 fields (null until sub-goal 31 switches to MetroSummaryWriteSchema)
      activities:   summary.activities   as unknown as string[],
      rapids_class: summary.rapids_class,
      rapids_note:  summary.rapids_note,
      tokens_in:    tokensIn,
      tokens_out:   tokensOut,
      cost_usd:     costUsd,
    });

    if (insertErr) {
      const { data: winner } = await supabase
        .from('metro_summaries')
        .select('body_md, headline, top_concerns, best_bets, activities, rapids_class, rapids_note, tokens_in, tokens_out, cost_usd, model')
        .eq('date', input.date)
        .eq('age_bucket', input.ageBucket)
        .eq('prompt_hash', promptHash)
        .maybeSingle();
      if (winner) {
        return {
          kind: 'metro',
          summary: {
            headline:        winner.headline,
            body_md:         winner.body_md,
            top_concerns:    winner.top_concerns as string[],
            best_bets_today: winner.best_bets as MetroSummary['best_bets_today'],
            disclaimer_kind: 'standard',
            ...(winner.activities   != null && { activities:   winner.activities   as MetroSummary['activities'] }),
            ...(winner.rapids_class != null && { rapids_class: winner.rapids_class as MetroSummary['rapids_class'] }),
            ...(winner.rapids_note  != null && { rapids_note:  winner.rapids_note }),
          },
          source: 'cache',
          tokensIn: winner.tokens_in,
          tokensOut: winner.tokens_out,
          costUsd: winner.cost_usd,
          cacheCreated: 0,
          cacheRead: 0,
          model: winner.model,
        };
      }
    }

    return { kind: 'metro', summary, source: 'generated', tokensIn, tokensOut, costUsd, cacheCreated, cacheRead, model };
  } catch {
    // ── 4. Stale-while-revalidate ────────────────────────────────────────
    const { data: stale } = await supabase
      .from('metro_summaries')
      .select('body_md, headline, top_concerns, best_bets, activities, rapids_class, rapids_note, tokens_in, tokens_out, cost_usd, model')
      .eq('age_bucket', input.ageBucket)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stale) {
      return {
        kind: 'metro',
        summary: {
          headline:        stale.headline,
          body_md:         stale.body_md,
          top_concerns:    stale.top_concerns as string[],
          best_bets_today: stale.best_bets as MetroSummary['best_bets_today'],
          disclaimer_kind: 'standard',
          ...(stale.activities   != null && { activities:   stale.activities   as MetroSummary['activities'] }),
          ...(stale.rapids_class != null && { rapids_class: stale.rapids_class as MetroSummary['rapids_class'] }),
          ...(stale.rapids_note  != null && { rapids_note:  stale.rapids_note }),
        },
        source: 'stale',
        tokensIn: stale.tokens_in,
        tokensOut: stale.tokens_out,
        costUsd: stale.cost_usd,
        cacheCreated: 0,
        cacheRead: 0,
        model: stale.model,
      };
    }
    return null;
  }
}

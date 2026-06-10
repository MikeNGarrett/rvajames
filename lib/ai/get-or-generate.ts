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
import { getAiDailyCostCeilingUsd } from '@/lib/env';

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

/**
 * SEC-3(b): quantize a sensor scalar for cache-keying ONLY — prompts still see
 * the raw values. Sensor ticks below the step no longer bust the cache, for
 * real 15-min USGS refreshes and attackers alike. Safe because the AI only
 * narrates; deterministic status (lib/safety/rules.ts) never reads these hashes.
 */
function quantize(value: number | null | undefined, step: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (step >= 1) return Math.round(value / step) * step;
  // Sub-1 steps: scale by the integer inverse to dodge float artifacts
  // (0.30000000000000004 would still hash deterministically, but keep it clean).
  const inv = Math.round(1 / step);
  return Math.round(value * inv) / inv;
}

// Quantization steps. Coarse enough to kill refresh-cycle churn, fine enough
// that the cached narrative stays accurate for the conditions it describes.
const QUANT = {
  gageFt: 0.25,
  dischargeCfs: 500,
  tempF: 2,
  precipIn: 0.1,
} as const;

// SEC-3(b): bump to orphan every cached row keyed under a previous hashing
// scheme. 'q1' = first quantized generation (2026-06-10).
const HASH_VERSION = 'q1' as const;

/** @internal Exported for hash-stability tests only. */
export function computeLocationHashForTest(input: InterpretLocationInput): string {
  return computeLocationHash(input);
}

function computeLocationHash(input: InterpretLocationInput): string {
  return computeHash(JSON.stringify({
    hashVersion: HASH_VERSION,
    date: input.date,
    // mode + daysOut distinguish a Saturday forecast generated on Thursday from
    // a Saturday observation generated on Saturday — same date, different prompts.
    mode: input.mode,
    daysOut: input.daysOut,
    locationSlug: input.locationSlug,
    ageBucket: input.ageBucket,
    gageFt: quantize(input.gageFt, QUANT.gageFt),
    dischargeCfs: quantize(input.dischargeCfs, QUANT.dischargeCfs),
    waterTempF: quantize(input.waterTempF, QUANT.tempF),
    airTempF: quantize(input.airTempF, QUANT.tempF),
    precip24hIn: quantize(input.precip24hIn, QUANT.precipIn),
    advisories: [...input.activeAdvisoryHeadlines].sort(),
    // Water quality changes (new reading, stale→current) trigger regeneration.
    waterQuality: input.waterQuality ?? null,
    // CSO: two scalars — count + timestamp are enough to detect new events
    // without over-fragmenting the cache on outfall-array reorderings.
    upstreamCsoCount: input.upstreamCso?.count ?? 0,
    upstreamCsoMostRecentAt: input.upstreamCso?.mostRecentAt ?? null,
  }));
}

/** @internal Exported for hash-stability tests only. */
export function computeMetroHashForTest(input: MetroSummaryInput): string {
  return computeMetroHash(input);
}

function computeMetroHash(input: MetroSummaryInput): string {
  return computeHash(JSON.stringify({
    promptVersion: PROMPT_VERSION,        // bump orphans all pre-b2 cached rows
    hashVersion: HASH_VERSION,
    date: input.date,
    // mode + daysOut ensure a Saturday forecast (generated Thursday) never collides
    // with a Saturday observation (generated Saturday).
    mode: input.mode,
    daysOut: input.daysOut,
    ageBucket: input.ageBucket,
    upriverGageFt: quantize(input.metroState.upriver.gageFt, QUANT.gageFt),
    upriverDischargeCfs: quantize(input.metroState.upriver.dischargeCfs, QUANT.dischargeCfs),
    upriverWaterTempF: quantize(input.metroState.upriver.waterTempF, QUANT.tempF),
    downriverGageFt: quantize(input.metroState.downriver.gageFt, QUANT.gageFt),
    airTempF: quantize(input.airTempF, QUANT.tempF),
    rain48hIn: quantize(input.rain48hIn ?? 0, QUANT.precipIn),
    activeCSOAdvisory: input.activeCSOAdvisory ?? false,
    advisories: [...input.activeAdvisoryHeadlines].sort(),
    // Closure changes naturally invalidate the cache — no manual version bump needed
    closures: (input.activeClosures ?? [])
      .map((c) => `${c.locationSlug}:${c.kind}`)
      .sort(),
    // CSO: count-only shape (sub-goal 96). Outfall names are no longer in the
    // prompt input — counts + advisory windows are sufficient to detect changes
    // that warrant a fresh AI generation.
    csoActivelyDischargingCount: input.cso?.activelyDischarging.count ?? 0,
    csoAdvisoryCount: input.cso?.advisoriesOnSelectedDate.count ?? 0,
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

// ─── SEC-3 cost controls: single-flight lock + daily circuit breaker ───────────

type ServiceClient = Awaited<ReturnType<typeof createServerClient>>;

// A winner holding the lock longer than this is presumed dead (eviction or
// crash mid-generation); the next requester clears the claim and takes over.
const LOCK_TTL_MS = 30_000;
// Losers poll for the winner's persisted row: 8 × 750ms ≈ 6s, which covers a
// typical Anthropic generation. Past that they fall back to stale content.
const POLL_INTERVAL_MS = 750;
const POLL_ATTEMPTS = 8;

/**
 * SEC-3(a): claim the cache key before calling Anthropic. The PRIMARY KEY on
 * ai_generation_locks makes the INSERT a race with exactly one winner — N
 * concurrent misses for the same prompt_hash collapse to 1 API call.
 */
async function acquireGenerationLock(
  supabase: ServiceClient,
  promptHash: string,
): Promise<boolean> {
  // Clear an expired claim first (winner crashed or blew the TTL).
  await supabase
    .from('ai_generation_locks')
    .delete()
    .eq('prompt_hash', promptHash)
    .lt('claimed_at', new Date(Date.now() - LOCK_TTL_MS).toISOString());

  const { error } = await supabase
    .from('ai_generation_locks')
    .insert({ prompt_hash: promptHash });
  return !error;
}

async function releaseGenerationLock(
  supabase: ServiceClient,
  promptHash: string,
): Promise<void> {
  await supabase.from('ai_generation_locks').delete().eq('prompt_hash', promptHash);
}

/**
 * SEC-3(c): daily spend circuit breaker. Sums cost_usd across both AI tables
 * for the current UTC day via the daily_ai_spend_usd SQL function (migration
 * 0020) — a server-side SUM, so it can't be fooled past PostgREST row caps.
 * Fails OPEN: a broken breaker must not take AI content down.
 */
async function isDailyCostCeilingTripped(supabase: ServiceClient): Promise<boolean> {
  const ceiling = await getAiDailyCostCeilingUsd();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase.rpc('daily_ai_spend_usd', {
    day_start: dayStart.toISOString(),
  });
  const spend = typeof data === 'string' ? parseFloat(data) : data;
  if (error || typeof spend !== 'number' || !Number.isFinite(spend)) {
    console.error('[ai-cost-breaker] spend query failed — failing open:', error?.message);
    return false;
  }

  if (spend >= ceiling) {
    console.error(
      `[ai-cost-breaker] TRIPPED: $${spend.toFixed(4)} spent today >= $${ceiling} ceiling — ` +
      'serving stale/deterministic content, zero Anthropic calls until next UTC day',
    );
    return true;
  }
  return false;
}

/**
 * Orchestrates a cache-miss: circuit breaker → single-flight lock → generate.
 * Fully injected so the race logic is unit-testable without Supabase/Anthropic.
 *
 * @internal Exported for tests only — production callers are getOrGenerate /
 * getOrGenerateMetro below.
 */
export interface GenerationGate<T> {
  isCeilingTripped: () => Promise<boolean>;
  tryAcquire: () => Promise<boolean>;
  release: () => Promise<void>;
  readCache: () => Promise<T | null>;
  generate: () => Promise<T>;
  readStale: () => Promise<T | null>;
  /** Test seam — defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

export async function runGenerationGate<T>(gate: GenerationGate<T>): Promise<T | null> {
  const sleep =
    gate.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  // (c) Above the daily ceiling: stale/deterministic only, no Anthropic.
  if (await gate.isCeilingTripped()) return gate.readStale();

  // (a) Single flight. Losers wait for the winner's row instead of generating.
  if (!(await gate.tryAcquire())) {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const result = await gate.readCache();
      if (result) return result;
    }
    return gate.readStale();
  }

  try {
    // Double-checked: a previous winner may have persisted its row between our
    // cache miss and our claim.
    const cached = await gate.readCache();
    if (cached) return cached;
    return await gate.generate();
  } catch {
    // Generation/parse failure → stale-while-revalidate, as before SEC-3.
    return gate.readStale();
  } finally {
    await gate.release();
  }
}

// ─── Location interpretation ───────────────────────────────────────────────────

/** Exact cache read for one (date, location, age, prompt_hash). Null on miss
 *  or legacy-format row (logged) — caller falls through to generate. */
async function readLocationCache(
  supabase: ServiceClient,
  input: InterpretLocationInput,
  locationId: string,
  promptHash: string,
): Promise<GetOrGenerateLocationResult | null> {
  const { data: exact } = await supabase
    .from('ai_interpretations')
    .select('body_md, tokens_in, tokens_out, cost_usd, model')
    .eq('date', input.date)
    .eq('location_id', locationId)
    .eq('age_bucket', input.ageBucket)
    .eq('prompt_hash', promptHash)
    .maybeSingle();

  if (!exact) return null;
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
    return null;
  }
}

/** Stale-while-revalidate read: most recent prior row for this location+age. */
async function readLocationStale(
  supabase: ServiceClient,
  locationId: string,
  ageBucket: AgeBucket,
): Promise<GetOrGenerateLocationResult | null> {
  const { data: stale } = await supabase
    .from('ai_interpretations')
    .select('body_md, tokens_in, tokens_out, cost_usd, model')
    .eq('location_id', locationId)
    .eq('age_bucket', ageBucket)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!stale) return null;
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
    // Stale row has legacy format — return null and let the next request regenerate.
    return null;
  }
}

export async function getOrGenerate(
  input: InterpretLocationInput,
  locationId: string,
  hasHighSeverityAdvisory: boolean,
): Promise<GetOrGenerateLocationResult | null> {
  const supabase = await createServerClient('service');
  const promptHash = computeLocationHash(input);
  const model = hasHighSeverityAdvisory ? MODELS.escalated : MODELS.default;

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  const cached = await readLocationCache(supabase, input, locationId, promptHash);
  if (cached) return cached;

  // ── 2. Cache miss: breaker → single-flight → generate (SEC-3) ────────────
  return runGenerationGate<GetOrGenerateLocationResult>({
    isCeilingTripped: () => isDailyCostCeilingTripped(supabase),
    tryAcquire: () => acquireGenerationLock(supabase, promptHash),
    release: () => releaseGenerationLock(supabase, promptHash),
    readCache: () => readLocationCache(supabase, input, locationId, promptHash),
    readStale: () => readLocationStale(supabase, locationId, input.ageBucket),
    generate: () => generateLocation(supabase, input, locationId, promptHash, model),
  });
}

/** The Anthropic call + persist + UNIQUE-race handling. Throws on API/parse
 *  failure — runGenerationGate catches and serves stale. */
async function generateLocation(
  supabase: ServiceClient,
  input: InterpretLocationInput,
  locationId: string,
  promptHash: string,
  model: string,
): Promise<GetOrGenerateLocationResult> {
  {
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
      // UNIQUE conflict — another writer won. Return its row; if that row has
      // a legacy format (readLocationCache → null), fall through to the
      // freshly generated result instead.
      const winner = await readLocationCache(supabase, input, locationId, promptHash);
      if (winner) return winner;
    }

    return { kind: 'location', interpretation, source: 'generated', tokensIn, tokensOut, costUsd, cacheCreated, cacheRead, model };
  }
}

// ─── Metro summary ─────────────────────────────────────────────────────────────

const METRO_ROW_COLUMNS =
  'body_md, headline, top_concerns, best_bets, activities, rapids_class, rapids_note, richmond_microcopy, tokens_in, tokens_out, cost_usd, model';

interface MetroRow {
  body_md: string;
  headline: string;
  top_concerns: unknown;
  best_bets: unknown;
  activities: unknown;
  rapids_class: unknown;
  rapids_note: string | null;
  richmond_microcopy: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  model: string;
}

/** metro_summaries stores structured columns; spread b2/b3 fields only when
 *  non-null (pre-version rows have NULL, treated as absent by the schema). */
function metroRowToResult(row: MetroRow, source: GenerationSource): GetOrGenerateMetroResult {
  return {
    kind: 'metro',
    summary: {
      headline:        row.headline,
      body_md:         row.body_md,
      top_concerns:    row.top_concerns as string[],
      best_bets_today: row.best_bets as MetroSummary['best_bets_today'],
      disclaimer_kind: 'standard',
      ...(row.activities         != null && { activities:         row.activities         as MetroSummary['activities'] }),
      ...(row.rapids_class       != null && { rapids_class:       row.rapids_class       as MetroSummary['rapids_class'] }),
      ...(row.rapids_note        != null && { rapids_note:        row.rapids_note }),
      ...(row.richmond_microcopy != null && { richmond_microcopy: row.richmond_microcopy }),
    },
    source,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
    cacheCreated: 0,
    cacheRead: 0,
    model: row.model,
  };
}

/** Exact cache read for one (date, age, prompt_hash). */
async function readMetroCache(
  supabase: ServiceClient,
  input: MetroSummaryInput,
  promptHash: string,
): Promise<GetOrGenerateMetroResult | null> {
  const { data: exact } = await supabase
    .from('metro_summaries')
    .select(METRO_ROW_COLUMNS)
    .eq('date', input.date)
    .eq('age_bucket', input.ageBucket)
    .eq('prompt_hash', promptHash)
    .maybeSingle();
  return exact ? metroRowToResult(exact, 'cache') : null;
}

/** Stale-while-revalidate read: most recent prior row for this age bucket. */
async function readMetroStale(
  supabase: ServiceClient,
  ageBucket: AgeBucket,
): Promise<GetOrGenerateMetroResult | null> {
  const { data: stale } = await supabase
    .from('metro_summaries')
    .select(METRO_ROW_COLUMNS)
    .eq('age_bucket', ageBucket)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return stale ? metroRowToResult(stale, 'stale') : null;
}

export async function getOrGenerateMetro(
  input: MetroSummaryInput,
  hasHighSeverityAdvisory: boolean,
): Promise<GetOrGenerateMetroResult | null> {
  const supabase = await createServerClient('service');
  const promptHash = computeMetroHash(input);
  const model = hasHighSeverityAdvisory ? MODELS.escalated : MODELS.default;

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  const cached = await readMetroCache(supabase, input, promptHash);
  if (cached) return cached;

  // ── 2. Cache miss: breaker → single-flight → generate (SEC-3) ────────────
  return runGenerationGate<GetOrGenerateMetroResult>({
    isCeilingTripped: () => isDailyCostCeilingTripped(supabase),
    tryAcquire: () => acquireGenerationLock(supabase, promptHash),
    release: () => releaseGenerationLock(supabase, promptHash),
    readCache: () => readMetroCache(supabase, input, promptHash),
    readStale: () => readMetroStale(supabase, input.ageBucket),
    generate: () => generateMetro(supabase, input, promptHash, model),
  });
}

/** The Anthropic call + persist + UNIQUE-race handling. Throws on API/parse
 *  failure — runGenerationGate catches and serves stale. */
async function generateMetro(
  supabase: ServiceClient,
  input: MetroSummaryInput,
  promptHash: string,
  model: string,
): Promise<GetOrGenerateMetroResult> {
  {
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
      // b2 fields — required by Write schema, always present on fresh generations.
      activities:         summary.activities   as unknown as string[],
      rapids_class:       summary.rapids_class,
      rapids_note:        summary.rapids_note,
      // b3 richmond_microcopy — optional on Write schema (sub-goal 91
      // hotfix). When the AI omits it the column gets null and the UI
      // degrades cleanly; ?? null keeps the column nullable-correct.
      richmond_microcopy: summary.richmond_microcopy ?? null,
      tokens_in:    tokensIn,
      tokens_out:   tokensOut,
      cost_usd:     costUsd,
    });

    if (insertErr) {
      const winner = await readMetroCache(supabase, input, promptHash);
      if (winner) return winner;
    }

    return { kind: 'metro', summary, source: 'generated', tokensIn, tokensOut, costUsd, cacheCreated, cacheRead, model };
  }
}

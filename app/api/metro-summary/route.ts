/**
 * GET /api/metro-summary?date=YYYY-MM-DD&age=<bucket>
 *
 * Returns the cached-or-generated metro river AI summary for the requested
 * date + age bucket. Thin HTTP wrapper over `getMetroSummary`, which itself
 * handles the full read-through-cache flow against `metro_summaries`.
 *
 * Designed to be called from the client component MetroSummaryPanel (sub-goal
 * 65) after the deterministic content has painted, so the browser `load` event
 * fires without waiting on AI streaming.
 *
 * Safe-to-be-public because:
 *   1. Writes to ai_interpretations / metro_summaries are dedup'd by
 *      prompt_hash inside getOrGenerateMetro — bounded write set per
 *      (date, age_bucket, prompt_hash) triple.
 *   2. Daily cost ceiling is 45 calls (9 locations × 5 ages) regardless of
 *      how many times this route is hit.
 *   3. Anthropic latency is the only marginal cost on cache miss; cache hit
 *      is a single DB SELECT (~10ms).
 *
 * Runtime: nodejs (default). Matches the cron routes; avoids edge-runtime
 * gotchas with the Anthropic SDK and supabase-js's underlying fetch wrapper.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMetroSummary } from '@/lib/queries/metro-summary';
import { isValidAgeBucket, type AgeBucket } from '@/lib/url-state';
import { isInWindow } from '@/lib/queries/date-range';

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  age:  z.string().refine(isValidAgeBucket, 'invalid age bucket'),
});

export async function GET(request: Request) {
  const url    = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    date: url.searchParams.get('date'),
    age:  url.searchParams.get('age'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', issues: parsed.error.format() },
      { status: 400 },
    );
  }

  // Reject dates outside the forecast window early — avoids a wasted Supabase
  // round-trip + makes the error contract obvious for misbehaving clients.
  if (!isInWindow(parsed.data.date)) {
    return NextResponse.json(
      { error: 'Date outside forecast window' },
      { status: 400 },
    );
  }

  try {
    const result = await getMetroSummary(
      parsed.data.date,
      parsed.data.age as AgeBucket,
    );

    // null means AI failed and no stale fallback row existed — true 502.
    if (!result.summary) {
      return NextResponse.json(
        { error: 'AI service unavailable; no cached fallback' },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { summary: result.summary, source: result.source },
      {
        status: 200,
        headers: {
          // Tighter than the plan default (max-age=60, SWR=300) because the
          // response is keyed by (date, age) — every filter combination is its
          // own cache entry. 30s fresh / 120s SWR keeps stale data bounded
          // while still absorbing burst traffic per chip click.
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      },
    );
  } catch (err) {
    console.error('[/api/metro-summary] threw:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

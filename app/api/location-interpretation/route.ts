/**
 * GET /api/location-interpretation?slug=<location>&date=YYYY-MM-DD&age=<bucket>
 *
 * Returns the cached-or-generated AI interpretation for a single access point
 * on the requested date + age bucket. Thin HTTP wrapper over `getLocationDetail`;
 * we discard the deterministic slice (advisories, resources, snapshot, etc.)
 * and return only `interpretation`, because the consuming component already
 * rendered the deterministic content server-side from the page query.
 *
 * Yes, this re-runs the deterministic Supabase queries that the page already
 * executed. The duplicated work (~50–100ms, mostly parallelized) is the price
 * of moving AI content off the server-render hot path so the browser `load`
 * event fires without waiting on Anthropic latency. Cache-miss AI calls are
 * still the dominant cost; the deterministic re-fetch is rounding error
 * compared to that.
 *
 * Safety + cost contract identical to /api/metro-summary — see header there.
 *
 * Runtime: nodejs (default).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getLocationDetail } from '@/lib/queries/location';
import { OutOfWindowError } from '@/lib/queries/today';
import { isValidAgeBucket, type AgeBucket } from '@/lib/url-state';
import { isInWindow } from '@/lib/queries/date-range';
import { enforceRateLimit } from '@/lib/rate-limit';

const QuerySchema = z.object({
  // Slug pattern matches the seeded locations (kebab-case lowercase). Reject
  // anything else early so an attacker can't enumerate via wildcards.
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/, 'invalid slug'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  age:  z.string().refine(isValidAgeBucket, 'invalid age bucket'),
});

export async function GET(request: Request) {
  // SEC-2: per-IP bucket, checked before any DB or AI work.
  const limited = await enforceRateLimit(request, 'PUBLIC_RATE_LIMITER');
  if (limited) return limited;

  const url    = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    slug: url.searchParams.get('slug'),
    date: url.searchParams.get('date'),
    age:  url.searchParams.get('age'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', issues: parsed.error.format() },
      { status: 400 },
    );
  }

  if (!isInWindow(parsed.data.date)) {
    return NextResponse.json(
      { error: 'Date outside forecast window' },
      { status: 400 },
    );
  }

  try {
    const location = await getLocationDetail(
      parsed.data.slug,
      parsed.data.date,
      parsed.data.age as AgeBucket,
    );

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    if (!location.interpretation) {
      return NextResponse.json(
        { error: 'AI service unavailable; no cached fallback' },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { interpretation: location.interpretation },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      },
    );
  } catch (err) {
    // OutOfWindowError mirrors the proactive isInWindow guard above; keeping
    // the catch is belt-and-suspenders for clock-skew or boundary cases.
    if (err instanceof OutOfWindowError) {
      return NextResponse.json(
        { error: 'Date outside forecast window' },
        { status: 400 },
      );
    }
    console.error('[/api/location-interpretation] threw:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

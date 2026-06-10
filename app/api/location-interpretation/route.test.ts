/**
 * Route handler tests for /api/location-interpretation.
 *
 * Covers param validation (slug + date + age), out-of-window rejection,
 * 404 for unknown slug, 502 for AI failure, happy path response shape.
 * getLocationDetail is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/queries/location', () => ({
  getLocationDetail: vi.fn(),
}));

vi.mock('@/lib/queries/date-range', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queries/date-range')>();
  return {
    ...actual,
    isInWindow: vi.fn(() => true),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
}));

import { getLocationDetail } from '@/lib/queries/location';
import { isInWindow }        from '@/lib/queries/date-range';
import { enforceRateLimit }  from '@/lib/rate-limit';
import { GET }                from './route';

const mockInterpretation = {
  status:      'safe' as const,
  headline:    'Great day for Belle Isle.',
  body_md:     'River is calm, water is warm.',
  activities:  [],
  prep_items:  ['water shoes', 'sunscreen'],
  attribution: ['USGS', 'NWS'],
};

const mockLocation = {
  id:                  'loc-1',
  slug:                'belle-isle',
  name:                'Belle Isle',
  lat:                 37.5,
  lng:                 -77.5,
  tags:                [],
  activities:          [],
  latestSnapshot:      null,
  deterministicStatus: { status: 'safe' as const, reason: '' },
  interpretation:      mockInterpretation,
  activeAdvisories:    [],
  resources:           [],
};

beforeEach(() => {
  vi.mocked(getLocationDetail).mockReset();
  vi.mocked(isInWindow).mockReset();
  vi.mocked(isInWindow).mockReturnValue(true);
  vi.mocked(enforceRateLimit).mockReset();
  vi.mocked(enforceRateLimit).mockResolvedValue(null);
});

describe('GET /api/location-interpretation — rate limiting (SEC-2)', () => {
  it('returns the 429 from the limiter before any query work', async () => {
    const tooMany = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
    vi.mocked(enforceRateLimit).mockResolvedValue(tooMany);

    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(getLocationDetail).not.toHaveBeenCalled();
  });

  it('uses the PUBLIC_RATE_LIMITER bucket', async () => {
    vi.mocked(getLocationDetail).mockResolvedValue(mockLocation as never);
    await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2026-05-30&age=6-9'),
    );
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), 'PUBLIC_RATE_LIMITER');
  });
});

describe('GET /api/location-interpretation — param validation', () => {
  it('returns 400 when slug is missing', async () => {
    const res = await GET(new Request('https://x/api/location-interpretation?date=2026-05-30&age=6-9'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when slug contains invalid characters', async () => {
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=Belle..Isle&date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is malformed', async () => {
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=tomorrow&age=6-9'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when age is not a valid bucket', async () => {
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2026-05-30&age=invalid'),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/location-interpretation — window rejection', () => {
  it('returns 400 when date is outside the forecast window', async () => {
    vi.mocked(isInWindow).mockReturnValue(false);
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2025-01-01&age=6-9'),
    );
    expect(res.status).toBe(400);
    expect(getLocationDetail).not.toHaveBeenCalled();
  });
});

describe('GET /api/location-interpretation — happy path', () => {
  it('returns 200 with the interpretation slice + cache headers', async () => {
    vi.mocked(getLocationDetail).mockResolvedValue(mockLocation as never);

    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown> & {
      error?:          string;
      interpretation?: { headline: string; prep_items: string[] };
    };
    expect(body.interpretation!.headline).toBe(mockInterpretation.headline);
    expect(body.interpretation!.prep_items).toEqual(mockInterpretation.prep_items);
    // Deterministic slice should NOT be in the response — the page already has it.
    expect(body.latestSnapshot).toBeUndefined();
    expect(body.resources).toBeUndefined();

    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=30, stale-while-revalidate=120',
    );
  });

  it('passes slug + date + age through to the query layer', async () => {
    vi.mocked(getLocationDetail).mockResolvedValue(mockLocation as never);
    await GET(
      new Request('https://x/api/location-interpretation?slug=pony-pasture&date=2026-06-02&age=10-13'),
    );
    expect(getLocationDetail).toHaveBeenCalledWith('pony-pasture', '2026-06-02', '10-13');
  });
});

describe('GET /api/location-interpretation — error paths', () => {
  it('returns 404 when the slug resolves to no location', async () => {
    vi.mocked(getLocationDetail).mockResolvedValue(null);
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=nope-not-a-place&date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 502 when interpretation is null (AI failed, no stale row)', async () => {
    vi.mocked(getLocationDetail).mockResolvedValue({
      ...mockLocation,
      interpretation: null,
    } as never);
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown> & {
      error?:          string;
      interpretation?: { headline: string; prep_items: string[] };
    };
    expect(body.error).toMatch(/AI service unavailable/i);
  });

  it('returns 500 when the query layer throws', async () => {
    vi.mocked(getLocationDetail).mockRejectedValue(new Error('db down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(
      new Request('https://x/api/location-interpretation?slug=belle-isle&date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});

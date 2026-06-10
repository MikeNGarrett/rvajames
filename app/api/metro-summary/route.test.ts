/**
 * Route handler tests for /api/metro-summary.
 *
 * Covers param validation, out-of-window rejection, AI failure → 502, happy
 * path response shape + Cache-Control header. The underlying getMetroSummary
 * is mocked so the test never touches Supabase or Anthropic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted above imports by vitest.
vi.mock('@/lib/queries/metro-summary', () => ({
  getMetroSummary: vi.fn(),
}));

vi.mock('@/lib/queries/date-range', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queries/date-range')>();
  return {
    ...actual,
    // Window check is the simplest thing to stub — return true so the happy-path
    // test isn't tied to whatever today's Richmond date is.
    isInWindow: vi.fn(() => true),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
}));

import { getMetroSummary } from '@/lib/queries/metro-summary';
import { isInWindow } from '@/lib/queries/date-range';
import { enforceRateLimit } from '@/lib/rate-limit';
import { GET } from './route';

const mockSummary = {
  headline:        'River is calm and warm — good day for the kids.',
  body_md:         'Gauge sitting at 3.8 ft, temp 76°F.',
  top_concerns:    [],
  best_bets_today: [{ location_slug: 'belle-isle', reason: 'Easy parking, flat trails' }],
  disclaimer_kind: 'standard',
};

beforeEach(() => {
  vi.mocked(getMetroSummary).mockReset();
  vi.mocked(isInWindow).mockReset();
  vi.mocked(isInWindow).mockReturnValue(true);
  vi.mocked(enforceRateLimit).mockReset();
  vi.mocked(enforceRateLimit).mockResolvedValue(null);
});

describe('GET /api/metro-summary — param validation', () => {
  it('returns 400 when date is missing', async () => {
    const res = await GET(new Request('https://x/api/metro-summary?age=6-9'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown> & {
      error?: string; summary?: { headline: string }; source?: string;
    };
    expect(body.error).toBe('Invalid query params');
  });

  it('returns 400 when age is missing', async () => {
    const res = await GET(new Request('https://x/api/metro-summary?date=2026-05-30'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is malformed', async () => {
    const res = await GET(new Request('https://x/api/metro-summary?date=2026/05/30&age=6-9'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when age is not a valid bucket', async () => {
    const res = await GET(new Request('https://x/api/metro-summary?date=2026-05-30&age=99'));
    expect(res.status).toBe(400);
  });

  it('accepts every valid age bucket', async () => {
    vi.mocked(getMetroSummary).mockResolvedValue({ summary: mockSummary as never, source: 'cache' });
    for (const age of ['0-2', '3-5', '6-9', '10-13', '14+', 'none']) {
      // encodeURIComponent matters for '14+' — raw '+' decodes to a space.
      const res = await GET(
        new Request(`https://x/api/metro-summary?date=2026-05-30&age=${encodeURIComponent(age)}`),
      );
      expect(res.status).toBe(200);
    }
  });

  it('rejects 14+ when the + is not URL-encoded (regression guard for the navigation hrefs)', async () => {
    // If a callsite forgets encodeURIComponent on age, the '+' decodes to a
    // space and the server reads age='14 ', which must fail validation.
    const res = await GET(
      new Request('https://x/api/metro-summary?date=2026-05-30&age=14+'),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/metro-summary — rate limiting (SEC-2)', () => {
  it('returns the 429 from the limiter before any query work', async () => {
    const tooMany = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
    vi.mocked(enforceRateLimit).mockResolvedValue(tooMany);

    const res = await GET(
      new Request('https://x/api/metro-summary?date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(getMetroSummary).not.toHaveBeenCalled();
  });

  it('uses the PUBLIC_RATE_LIMITER bucket', async () => {
    vi.mocked(getMetroSummary).mockResolvedValue({ summary: mockSummary as never, source: 'cache' });
    await GET(new Request('https://x/api/metro-summary?date=2026-05-30&age=6-9'));
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), 'PUBLIC_RATE_LIMITER');
  });
});

describe('GET /api/metro-summary — window rejection', () => {
  it('returns 400 when date is outside the forecast window', async () => {
    vi.mocked(isInWindow).mockReturnValue(false);
    const res = await GET(
      new Request('https://x/api/metro-summary?date=2025-01-01&age=6-9'),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown> & {
      error?: string; summary?: { headline: string }; source?: string;
    };
    expect(body.error).toBe('Date outside forecast window');
    // Should reject before hitting the query layer.
    expect(getMetroSummary).not.toHaveBeenCalled();
  });
});

describe('GET /api/metro-summary — happy path', () => {
  it('returns 200 with the summary + source + cache headers', async () => {
    vi.mocked(getMetroSummary).mockResolvedValue({
      summary: mockSummary as never,
      source:  'cache',
    });

    const res = await GET(
      new Request('https://x/api/metro-summary?date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown> & {
      error?: string; summary?: { headline: string }; source?: string;
    };
    expect(body.summary!.headline).toBe(mockSummary.headline);
    expect(body.source).toBe('cache');

    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=30, stale-while-revalidate=120',
    );
  });

  it('passes the parsed date + age through to the query layer', async () => {
    vi.mocked(getMetroSummary).mockResolvedValue({ summary: mockSummary as never, source: 'cache' });
    await GET(new Request('https://x/api/metro-summary?date=2026-06-01&age=3-5'));
    expect(getMetroSummary).toHaveBeenCalledWith('2026-06-01', '3-5');
  });
});

describe('GET /api/metro-summary — AI failure', () => {
  it('returns 502 when the query layer returns a null summary', async () => {
    vi.mocked(getMetroSummary).mockResolvedValue({ summary: null, source: null });
    const res = await GET(
      new Request('https://x/api/metro-summary?date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown> & {
      error?: string; summary?: { headline: string }; source?: string;
    };
    expect(body.error).toMatch(/AI service unavailable/i);
  });

  it('returns 500 when the query layer throws', async () => {
    vi.mocked(getMetroSummary).mockRejectedValue(new Error('supabase down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(
      new Request('https://x/api/metro-summary?date=2026-05-30&age=6-9'),
    );
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});

/**
 * Tests for lib/safety/upstream-cso.ts — sub-goal 83.
 *
 * All Supabase queries are mocked; no I/O.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';
import { getUpstreamCsoForLocation } from './upstream-cso';

// ── Mock helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal Supabase mock for the advisories + cso_outfalls join query.
 *
 * The query chain is:
 *   .from('advisories')
 *   .select('effective_from, cso_outfalls!inner(...)')
 *   .eq('kind', 'cso_overflow')
 *   .eq('source', 'emnet_cso')
 *   .gt('effective_from', windowStart)
 *   .lt('cso_outfalls.lng', locationLng)
 *   .eq('cso_outfalls.affects_james_mainstem', true)
 *   .order('effective_from', { ascending: false })
 */
function makeMockClient(rows: object[], queryError: { message: string } | null = null) {
  const orderMock = vi.fn().mockResolvedValue({ data: rows, error: queryError });
  const eq2Mock   = vi.fn().mockReturnValue({ order: orderMock });
  const ltMock    = vi.fn().mockReturnValue({ eq: eq2Mock });
  const gtMock    = vi.fn().mockReturnValue({ lt: ltMock });
  const eq1Mock   = vi.fn().mockReturnValue({ gt: gtMock });
  const eqKindMock = vi.fn().mockReturnValue({ eq: eq1Mock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqKindMock });
  const fromMock   = vi.fn().mockReturnValue({ select: selectMock });
  return { from: fromMock };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** An outfall row as returned by the Supabase embedded select */
function makeRow(
  name: string,
  lng: number,
  affectsMainstem: boolean,
  effectiveFrom: string,
) {
  return {
    effective_from: effectiveFrom,
    cso_outfalls: { name, lng, affects_james_mainstem: affectsMainstem },
  };
}

// 1 hour ago, well inside the 48-hour window
const RECENT = new Date(Date.now() - 3_600_000).toISOString();

// Pony Pasture lng ≈ -77.515
const LOCATION_LNG = -77.515;
// Upstream outfall (further west = smaller lng)
const UPSTREAM_LNG = -77.55;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getUpstreamCsoForLocation', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns count=0 / empty outfalls when query returns no rows', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient([]) as never);
    const result = await getUpstreamCsoForLocation(LOCATION_LNG);
    expect(result.count).toBe(0);
    expect(result.mostRecentAt).toBeNull();
    expect(result.outfalls).toHaveLength(0);
  });

  it('counts an upstream outfall (lng < locationLng) within the window', async () => {
    const rows = [makeRow('Manchester CSO', UPSTREAM_LNG, true, RECENT)];
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient(rows) as never);

    const result = await getUpstreamCsoForLocation(LOCATION_LNG);

    expect(result.count).toBe(1);
    expect(result.mostRecentAt).toBe(RECENT);
    expect(result.outfalls[0].name).toBe('Manchester CSO');
    expect(result.outfalls[0].hoursAgo).toBeGreaterThanOrEqual(0);
    expect(result.outfalls[0].hoursAgo).toBeLessThanOrEqual(2);
  });

  /**
   * Downstream outfalls are filtered out by the query (lng > locationLng),
   * so the mock returns an empty set — simulating correct DB filtering.
   */
  it('does NOT count a downstream outfall (query mock returns empty)', async () => {
    // The DB filters lng < locationLng; downstream rows never come back.
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient([]) as never);

    const result = await getUpstreamCsoForLocation(LOCATION_LNG);
    expect(result.count).toBe(0);
  });

  /**
   * Outfalls outside the 48h window are filtered by the query.
   * Mock returns empty to simulate the DB-side effective_from > windowStart filter.
   */
  it('does NOT count an outfall outside the 48h window (query mock returns empty)', async () => {
    // The DB filters effective_from > windowStart; OLD rows never come back.
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient([]) as never);

    const result = await getUpstreamCsoForLocation(LOCATION_LNG);
    expect(result.count).toBe(0);
  });

  /**
   * Non-mainstem outfalls are filtered by the query (affects_james_mainstem=false).
   * Mock returns empty to simulate the DB-side filter.
   */
  it('does NOT count an outfall with affects_james_mainstem=false (query mock returns empty)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient([]) as never);

    const result = await getUpstreamCsoForLocation(LOCATION_LNG);
    expect(result.count).toBe(0);
  });

  it('returns multiple outfalls ordered by effective_from DESC (most recent first)', async () => {
    const older  = new Date(Date.now() - 10 * 3_600_000).toISOString();
    const newer  = new Date(Date.now() -  2 * 3_600_000).toISOString();
    // DB returns rows in DESC order already
    const rows = [
      makeRow('Manchester CSO', UPSTREAM_LNG, true, newer),
      makeRow('Belle Isle CSO', UPSTREAM_LNG - 0.01, true, older),
    ];
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient(rows) as never);

    const result = await getUpstreamCsoForLocation(LOCATION_LNG);

    expect(result.count).toBe(2);
    expect(result.mostRecentAt).toBe(newer);
    expect(result.outfalls[0].name).toBe('Manchester CSO');
    expect(result.outfalls[1].name).toBe('Belle Isle CSO');
    expect(result.outfalls[0].hoursAgo).toBeLessThan(result.outfalls[1].hoursAgo);
  });

  it('returns count=0 on Supabase query error (defensive)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeMockClient([], { message: 'connection refused' }) as never,
    );
    const result = await getUpstreamCsoForLocation(LOCATION_LNG);
    expect(result.count).toBe(0);
    expect(result.mostRecentAt).toBeNull();
  });

  it('computes hoursAgo correctly for a 3-hour-old event', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const rows = [makeRow('Test Outfall', UPSTREAM_LNG, true, threeHoursAgo)];
    vi.mocked(createServerClient).mockResolvedValue(makeMockClient(rows) as never);

    const result = await getUpstreamCsoForLocation(LOCATION_LNG);
    // Math.floor — should be 3 (within ±1 due to ms timing in tests)
    expect(result.outfalls[0].hoursAgo).toBeGreaterThanOrEqual(2);
    expect(result.outfalls[0].hoursAgo).toBeLessThanOrEqual(4);
  });
});

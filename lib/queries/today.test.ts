import { describe, it, expect } from 'vitest';
import { computeActiveCsoOutfalls } from './today';
import type { LocationSummary } from './today';

// Minimal location-summary stub — only the upstreamCso field is needed.
function makeLocation(
  outfalls: Array<{ name: string; hoursAgo: number }>,
): Pick<LocationSummary, 'upstreamCso'> {
  if (!outfalls.length) return { upstreamCso: null };
  return {
    upstreamCso: {
      count: outfalls.length,
      mostRecentAt: new Date(Date.now() - outfalls[0].hoursAgo * 3_600_000).toISOString(),
      outfalls: outfalls.map((o) => ({
        name: o.name,
        hoursAgo: o.hoursAgo,
        csoOccurredAt: new Date(Date.now() - o.hoursAgo * 3_600_000).toISOString(),
      })),
    },
  };
}

describe('computeActiveCsoOutfalls', () => {
  it('returns empty array when all locations have null upstreamCso', () => {
    const result = computeActiveCsoOutfalls([
      { upstreamCso: null },
      { upstreamCso: null },
    ]);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(computeActiveCsoOutfalls([])).toEqual([]);
  });

  it('returns a single outfall from a single location', () => {
    const result = computeActiveCsoOutfalls([
      makeLocation([{ name: 'Shockoe Bottom', hoursAgo: 10 }]),
    ]);
    expect(result).toEqual([{ name: 'Shockoe Bottom', hoursAgo: 10 }]);
  });

  it('deduplicates by outfall name, keeping the minimum hoursAgo', () => {
    const result = computeActiveCsoOutfalls([
      makeLocation([{ name: 'Outfall A', hoursAgo: 20 }]),
      makeLocation([{ name: 'Outfall A', hoursAgo: 5 }]),   // more recent — should win
      makeLocation([{ name: 'Outfall A', hoursAgo: 35 }]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Outfall A', hoursAgo: 5 });
  });

  it('sorts ascending by hoursAgo (most recent first)', () => {
    const result = computeActiveCsoOutfalls([
      makeLocation([{ name: 'Old Outfall', hoursAgo: 40 }]),
      makeLocation([{ name: 'New Outfall', hoursAgo: 2 }]),
      makeLocation([{ name: 'Mid Outfall', hoursAgo: 18 }]),
    ]);
    expect(result.map((o) => o.name)).toEqual(['New Outfall', 'Mid Outfall', 'Old Outfall']);
  });

  it('handles a location with multiple outfalls', () => {
    const result = computeActiveCsoOutfalls([
      makeLocation([
        { name: 'Outfall X', hoursAgo: 6 },
        { name: 'Outfall Y', hoursAgo: 12 },
      ]),
    ]);
    expect(result).toEqual([
      { name: 'Outfall X', hoursAgo: 6 },
      { name: 'Outfall Y', hoursAgo: 12 },
    ]);
  });

  it('mixes null and non-null locations correctly', () => {
    const result = computeActiveCsoOutfalls([
      { upstreamCso: null },
      makeLocation([{ name: 'Active Outfall', hoursAgo: 3 }]),
      { upstreamCso: null },
    ]);
    expect(result).toEqual([{ name: 'Active Outfall', hoursAgo: 3 }]);
  });

  it('deduplication: same outfall seen from multiple locations — keeps minimum', () => {
    const result = computeActiveCsoOutfalls([
      makeLocation([
        { name: 'Shared A', hoursAgo: 14 },
        { name: 'Unique B', hoursAgo: 7 },
      ]),
      makeLocation([
        { name: 'Shared A', hoursAgo: 2 },  // min — wins
        { name: 'Unique C', hoursAgo: 30 },
      ]),
    ]);
    expect(result.find((o) => o.name === 'Shared A')?.hoursAgo).toBe(2);
    expect(result).toHaveLength(3);
    expect(result[0].hoursAgo).toBeLessThanOrEqual(result[1].hoursAgo);
  });
});

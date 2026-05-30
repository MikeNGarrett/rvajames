import { describe, it, expect } from 'vitest';
import { buildAdvisoryDateFilter } from './today';

// ── buildAdvisoryDateFilter ───────────────────────────────────────────────────
//
// Covers the "observed-mode (today)", "forecast-within-window (+1/+2 day)", and
// "month-boundary rollover" cases specified in sub-goal 94.
//
// The filter ensures: effective_from < start-of-next-day AND effective_to > start-of-selected-day.
// Both bounds are UTC midnight strings. This correctly selects advisories that
// overlap the selected calendar day in UTC.

describe('buildAdvisoryDateFilter', () => {
  it('observed today (2026-05-30): fromLt = next midnight, toGt = today midnight', () => {
    const f = buildAdvisoryDateFilter('2026-05-30');
    expect(f.fromLt).toBe('2026-05-31T00:00:00Z');
    expect(f.toGt).toBe('2026-05-30T00:00:00Z');
  });

  it('forecast day +1 (2026-05-31): fromLt = 2026-06-01, toGt = 2026-05-31', () => {
    const f = buildAdvisoryDateFilter('2026-05-31');
    expect(f.fromLt).toBe('2026-06-01T00:00:00Z');
    expect(f.toGt).toBe('2026-05-31T00:00:00Z');
  });

  it('forecast day +2 (2026-06-01): fromLt = 2026-06-02, toGt = 2026-06-01', () => {
    const f = buildAdvisoryDateFilter('2026-06-01');
    expect(f.fromLt).toBe('2026-06-02T00:00:00Z');
    expect(f.toGt).toBe('2026-06-01T00:00:00Z');
  });

  it('handles year-end rollover (2026-12-31)', () => {
    const f = buildAdvisoryDateFilter('2026-12-31');
    expect(f.fromLt).toBe('2027-01-01T00:00:00Z');
    expect(f.toGt).toBe('2026-12-31T00:00:00Z');
  });

  it('handles leap-year day (2028-02-28 → next day = 2028-02-29)', () => {
    const f = buildAdvisoryDateFilter('2028-02-28');
    expect(f.fromLt).toBe('2028-02-29T00:00:00Z');
    expect(f.toGt).toBe('2028-02-28T00:00:00Z');
  });

  it('fromLt is always one day ahead of toGt', () => {
    const dates = ['2026-01-01', '2026-03-14', '2026-09-30', '2026-11-07'];
    for (const d of dates) {
      const f = buildAdvisoryDateFilter(d);
      const toLt = new Date(f.fromLt).getTime();
      const toGt = new Date(f.toGt).getTime();
      expect(toLt - toGt).toBe(86_400_000); // exactly 24h
    }
  });
});

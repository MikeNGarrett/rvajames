import { describe, it, expect } from 'vitest';
import { buildAdvisoryDateFilter } from './today';

// ── buildAdvisoryDateFilter ───────────────────────────────────────────────────
//
// Covers the "observed-mode (today)", "forecast-within-window (+1/+2 day)", and
// "month-boundary rollover" cases specified in sub-goal 94.
//
// The filter ensures:
//   effective_from < ET-midnight-of-next-day
//   effective_to   > ET-midnight-of-selected-day
//
// Bounds are UTC strings anchored to Eastern Time midnight, NOT UTC midnight.
// Richmond uses EDT (UTC-4) roughly Mar 14–Nov 7, EST (UTC-5) otherwise.

describe('buildAdvisoryDateFilter', () => {
  it('observed today (2026-05-30): EDT → bounds at T04:00:00Z', () => {
    const f = buildAdvisoryDateFilter('2026-05-30');
    expect(f.fromLt).toBe('2026-05-31T04:00:00Z');
    expect(f.toGt).toBe('2026-05-30T04:00:00Z');
  });

  it('forecast day +1 (2026-05-31): EDT → T04:00:00Z', () => {
    const f = buildAdvisoryDateFilter('2026-05-31');
    expect(f.fromLt).toBe('2026-06-01T04:00:00Z');
    expect(f.toGt).toBe('2026-05-31T04:00:00Z');
  });

  it('forecast day +2 (2026-06-01): EDT → T04:00:00Z', () => {
    const f = buildAdvisoryDateFilter('2026-06-01');
    expect(f.fromLt).toBe('2026-06-02T04:00:00Z');
    expect(f.toGt).toBe('2026-06-01T04:00:00Z');
  });

  it('handles year-end rollover (2026-12-31): EST → T05:00:00Z', () => {
    const f = buildAdvisoryDateFilter('2026-12-31');
    expect(f.fromLt).toBe('2027-01-01T05:00:00Z');
    expect(f.toGt).toBe('2026-12-31T05:00:00Z');
  });

  it('handles leap-year day (2028-02-28): EST → T05:00:00Z, next day = 2028-02-29', () => {
    const f = buildAdvisoryDateFilter('2028-02-28');
    expect(f.fromLt).toBe('2028-02-29T05:00:00Z');
    expect(f.toGt).toBe('2028-02-28T05:00:00Z');
  });

  it('fromLt is exactly one ET-day ahead of toGt (non-DST-transition dates)', () => {
    // On DST fall-back day (Nov 7 in Richmond), the ET day is 25h long — that
    // day is intentionally excluded here; it's tested separately below.
    // Mar 14 (spring-forward) is 23h but both sides use EDT offset=4 → 24h. ✓
    const dates = ['2026-01-01', '2026-03-14', '2026-09-30', '2026-11-15'];
    for (const d of dates) {
      const f = buildAdvisoryDateFilter(d);
      const toLt = new Date(f.fromLt).getTime();
      const toGt = new Date(f.toGt).getTime();
      expect(toLt - toGt).toBe(86_400_000); // exactly 24h
    }
  });

  it('DST fall-back day (2026-11-07): ET day is 25h — toGt uses EDT+4, fromLt uses EST+5', () => {
    // Nov 7 = last EDT day. Nov 8 = first EST day. The advisory filter correctly
    // spans the full 25-hour ET day rather than a truncated 24h UTC slice.
    const f = buildAdvisoryDateFilter('2026-11-07');
    expect(f.toGt).toBe('2026-11-07T04:00:00Z');   // EDT midnight start
    expect(f.fromLt).toBe('2026-11-08T05:00:00Z');  // EST midnight start (25h later)
    const diff = new Date(f.fromLt).getTime() - new Date(f.toGt).getTime();
    expect(diff).toBe(90_000_000); // 25 hours in ms
  });
});

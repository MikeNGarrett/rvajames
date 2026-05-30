import { describe, it, expect } from 'vitest';
import { formatDateParam, isValidAgeBucket, AGE_BUCKETS } from './url-state';

// ── formatDateParam — must anchor to Richmond ET, not UTC ────────────────────
//
// Previous implementation used `.toISOString().split('T')[0]` which returns
// the UTC calendar date. Between ~8pm and midnight ET, UTC has already rolled
// to the next day, producing a wrong-day URL default and showing tomorrow's
// forecast as today's "observed" view.

describe('formatDateParam', () => {
  it('returns the Richmond date during normal mid-day hours', () => {
    // 2026-05-30 18:00 UTC = 2026-05-30 14:00 EDT
    const d = new Date('2026-05-30T18:00:00Z');
    expect(formatDateParam(d)).toBe('2026-05-30');
  });

  it('returns the Richmond date when UTC has already rolled to tomorrow (EDT)', () => {
    // 2026-05-31 03:00 UTC = 2026-05-30 23:00 EDT
    // OLD behavior: returned '2026-05-31' (wrong — user is still on the 30th in Richmond)
    // NEW behavior: returns '2026-05-30' (correct)
    const d = new Date('2026-05-31T03:00:00Z');
    expect(formatDateParam(d)).toBe('2026-05-30');
  });

  it('returns the Richmond date when UTC has already rolled to tomorrow (EST)', () => {
    // 2026-12-31 04:30 UTC = 2026-12-30 23:30 EST
    // EST is UTC-5, so the rollover gap is 5h instead of 4h.
    const d = new Date('2026-12-31T04:30:00Z');
    expect(formatDateParam(d)).toBe('2026-12-30');
  });

  it('handles DST spring-forward day correctly', () => {
    // 2026-03-14 06:00 UTC = 2026-03-14 01:00 EST (DST starts at 2 AM that day)
    const d = new Date('2026-03-14T06:00:00Z');
    expect(formatDateParam(d)).toBe('2026-03-14');
  });

  it('handles DST fall-back day correctly', () => {
    // 2026-11-08 05:30 UTC = 2026-11-08 00:30 EST (after DST ends)
    const d = new Date('2026-11-08T05:30:00Z');
    expect(formatDateParam(d)).toBe('2026-11-08');
  });
});

// ── isValidAgeBucket ──────────────────────────────────────────────────────────

describe('isValidAgeBucket', () => {
  it('returns true for every documented bucket', () => {
    for (const bucket of AGE_BUCKETS) {
      expect(isValidAgeBucket(bucket)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isValidAgeBucket('')).toBe(false);
    expect(isValidAgeBucket('all-ages')).toBe(false);
    expect(isValidAgeBucket('0-99')).toBe(false);
  });
});

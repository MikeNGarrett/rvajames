import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDateParam, isValidAgeBucket, AGE_BUCKETS, searchParamsCache } from './url-state';

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

// ── searchParamsCache — no stale module-init default for `date` ──────────────
//
// The previous implementation used `parseAsIsoDate.withDefault(new Date())`.
// That `new Date()` evaluated ONCE at module load, so warm Cloudflare Workers
// served the same default date for hours. Call sites now substitute
// `new Date()` per-request via the `date ?? new Date()` pattern in
// app/page.tsx and app/locations/[slug]/page.tsx.
//
// The behavior we assert at this layer: the cache returns `date: null` when
// no ?date= param is present. Combined with the per-request substitution at
// call sites, this proves no module-init Date can leak across requests.

describe('searchParamsCache.parse — date default', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns date: null when ?date= is absent (no module-init default)', () => {
    vi.setSystemTime(new Date('2026-05-30T12:00:00Z'));
    const result = searchParamsCache.parse({});
    expect(result.date).toBeNull();
  });

  it('still returns null after a 24h time advance — confirms no Date capture at any layer', () => {
    // If the cache captured `new Date()` at parse() time and reused it, we'd
    // see the same Date instance on subsequent calls. With no default, both
    // calls return null regardless of clock state.
    vi.setSystemTime(new Date('2026-05-30T12:00:00Z'));
    const first = searchParamsCache.parse({});
    vi.setSystemTime(new Date('2026-05-31T12:00:00Z'));
    const second = searchParamsCache.parse({});
    expect(first.date).toBeNull();
    expect(second.date).toBeNull();
  });

  it('returns the date string as-is when ?date= is provided', () => {
    const result = searchParamsCache.parse({ date: '2026-05-15' });
    // parseAsString keeps the URL value verbatim — no UTC-midnight Date conversion
    // that would roll back one ET day via formatRichmondDate.
    expect(result.date).toBe('2026-05-15');
  });

  it('still applies the age default when ?age= is absent', () => {
    const result = searchParamsCache.parse({});
    expect(result.age).toBe('6-9');
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

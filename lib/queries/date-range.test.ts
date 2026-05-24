import { describe, it, expect } from 'vitest';
import { getForecastWindow, isInWindow } from './date-range';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Date at a specific wall-clock time in Richmond (America/New_York).
 * We construct a UTC instant that maps to the given local time in ET.
 *
 * Richmond is UTC-4 (EDT) in summer and UTC-5 (EST) in winter.
 * These tests pin May dates so they use EDT (UTC-4) throughout.
 */
function richmondTime(year: number, month: number, day: number, hour = 12): Date {
  // Construct a reasonable approximation: use Intl to discover the current
  // UTC-offset for that date, then build the UTC instant.
  // Simpler and test-safe: use a known EDT offset (-4) for May dates.
  const EDT_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4 in May
  return new Date(Date.UTC(year, month - 1, day, hour + 4, 0, 0));
  void EDT_OFFSET_MS; // referenced only for documentation clarity
}

// ─── getForecastWindow ────────────────────────────────────────────────────────

describe('getForecastWindow', () => {
  it('returns exactly 4 chips', () => {
    const chips = getForecastWindow(richmondTime(2026, 5, 24));
    expect(chips).toHaveLength(4);
  });

  it('first chip is today: mode=observed, label=Today, daysOut=0', () => {
    const chips = getForecastWindow(richmondTime(2026, 5, 24));
    const today = chips[0];
    expect(today.iso).toBe('2026-05-24');
    expect(today.label).toBe('Today');
    expect(today.shortLabel).toBe('Today');
    expect(today.mode).toBe('observed');
    expect(today.daysOut).toBe(0);
    expect(today.forecastConfidence).toBeNull();
  });

  it('chip +1: mode=forecast, confidence=high, daysOut=1', () => {
    const chips = getForecastWindow(richmondTime(2026, 5, 24));
    const chip1 = chips[1];
    expect(chip1.iso).toBe('2026-05-25');
    expect(chip1.mode).toBe('forecast');
    expect(chip1.daysOut).toBe(1);
    expect(chip1.forecastConfidence).toBe('high');
  });

  it('chip +2: mode=forecast, confidence=medium, daysOut=2', () => {
    const chips = getForecastWindow(richmondTime(2026, 5, 24));
    const chip2 = chips[2];
    expect(chip2.iso).toBe('2026-05-26');
    expect(chip2.mode).toBe('forecast');
    expect(chip2.daysOut).toBe(2);
    expect(chip2.forecastConfidence).toBe('medium');
  });

  it('chip +3: mode=forecast, confidence=low, daysOut=3', () => {
    const chips = getForecastWindow(richmondTime(2026, 5, 24));
    const chip3 = chips[3];
    expect(chip3.iso).toBe('2026-05-27');
    expect(chip3.mode).toBe('forecast');
    expect(chip3.daysOut).toBe(3);
    expect(chip3.forecastConfidence).toBe('low');
  });

  it('forecast chips have weekday+date labels (e.g. "Mon, May 25")', () => {
    const chips = getForecastWindow(richmondTime(2026, 5, 24)); // Sunday May 24
    // May 25 is a Monday
    expect(chips[1].label).toBe('Mon, May 25');
    expect(chips[1].shortLabel).toBe('Mon');
  });

  it('labels roll over month boundary correctly', () => {
    // May 31 → June 1, June 2, June 3
    const chips = getForecastWindow(richmondTime(2026, 5, 31));
    expect(chips[0].iso).toBe('2026-05-31');
    expect(chips[1].iso).toBe('2026-06-01');
    expect(chips[2].iso).toBe('2026-06-02');
    expect(chips[3].iso).toBe('2026-06-03');
    // Labels should reference June
    expect(chips[1].label).toMatch(/Jun/);
  });

  // ── Timezone edge: 11 PM Richmond = next day UTC ────────────────────────────

  it('at 11 PM Richmond time, today is still the Richmond calendar date', () => {
    // 11 PM EDT = 03:00 UTC next day
    // richmondTime with hour=23: UTC = 23+4=27 → 03:00 next UTC day
    const elevenPmRichmond = new Date(Date.UTC(2026, 4, 24, 27, 0, 0)); // 27h = next day 03:00
    const chips = getForecastWindow(elevenPmRichmond);
    // Richmond date should be 2026-05-24, not 2026-05-25
    expect(chips[0].iso).toBe('2026-05-24');
  });

  it('just after midnight Richmond, today advances to new date', () => {
    // 12:01 AM EDT = 04:01 UTC same UTC day
    const justAfterMidnight = new Date(Date.UTC(2026, 4, 25, 4, 1, 0)); // 04:01 UTC = 00:01 EDT May 25
    const chips = getForecastWindow(justAfterMidnight);
    expect(chips[0].iso).toBe('2026-05-25');
  });
});

// ─── isInWindow ───────────────────────────────────────────────────────────────

describe('isInWindow', () => {
  const anchor = richmondTime(2026, 5, 24); // May 24

  it('today is in window', () => {
    expect(isInWindow('2026-05-24', anchor)).toBe(true);
  });

  it('tomorrow is in window', () => {
    expect(isInWindow('2026-05-25', anchor)).toBe(true);
  });

  it('day +2 is in window', () => {
    expect(isInWindow('2026-05-26', anchor)).toBe(true);
  });

  it('day +3 is in window', () => {
    expect(isInWindow('2026-05-27', anchor)).toBe(true);
  });

  it('day +4 is NOT in window', () => {
    expect(isInWindow('2026-05-28', anchor)).toBe(false);
  });

  it('yesterday is NOT in window', () => {
    expect(isInWindow('2026-05-23', anchor)).toBe(false);
  });

  it('far future date is NOT in window', () => {
    expect(isInWindow('2030-01-01', anchor)).toBe(false);
  });

  it('far past date is NOT in window', () => {
    expect(isInWindow('2020-06-15', anchor)).toBe(false);
  });

  it('isInWindow uses current time by default (smoke test: does not throw)', () => {
    // Just verify it runs without error when no anchor is provided
    const result = isInWindow(new Date().toISOString().slice(0, 10));
    expect(typeof result).toBe('boolean');
  });
});

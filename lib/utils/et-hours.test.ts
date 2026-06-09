import { describe, it, expect } from 'vitest';
import { etHourKeyFromIso, etHourKeyFromDate, pickHourByKey } from './et-hours';

describe('etHourKeyFromIso', () => {
  it('extracts the ET hour key from a bare Open-Meteo timestamp', () => {
    expect(etHourKeyFromIso('2026-06-09T14:00')).toBe('2026-06-09T14');
  });

  it('extracts the same key from an NWS offset-bearing timestamp for the same hour', () => {
    expect(etHourKeyFromIso('2026-06-09T14:00:00-04:00')).toBe('2026-06-09T14');
  });

  it('Open-Meteo and NWS timestamps for the same hour produce identical keys', () => {
    // This is the property the outlook-zip alignment relies on.
    expect(etHourKeyFromIso('2026-06-09T09:00')).toBe(
      etHourKeyFromIso('2026-06-09T09:00:00-04:00'),
    );
  });

  it('midnight is a distinct key from afternoon (the core bug)', () => {
    expect(etHourKeyFromIso('2026-06-09T00:00')).not.toBe(
      etHourKeyFromIso('2026-06-09T14:00'),
    );
  });
});

describe('etHourKeyFromDate', () => {
  it('produces an ET hour key for a UTC instant during EDT', () => {
    // 2026-06-09T18:30:00Z = 14:30 EDT (UTC-4) → key for 2pm ET.
    const d = new Date('2026-06-09T18:30:00Z');
    expect(etHourKeyFromDate(d)).toBe('2026-06-09T14');
  });

  it('handles the EST offset (winter, UTC-5)', () => {
    // 2026-01-15T18:30:00Z = 13:30 EST (UTC-5) → 1pm ET.
    const d = new Date('2026-01-15T18:30:00Z');
    expect(etHourKeyFromDate(d)).toBe('2026-01-15T13');
  });

  it('rolls the date back when UTC is past midnight but ET is still the prior day', () => {
    // 2026-06-09T02:00:00Z = 22:00 EDT on 2026-06-08.
    const d = new Date('2026-06-09T02:00:00Z');
    expect(etHourKeyFromDate(d)).toBe('2026-06-08T22');
  });

  it('normalizes ET midnight to hour 00 (not 24)', () => {
    // 2026-06-09T04:00:00Z = 00:00 EDT on 2026-06-09.
    const d = new Date('2026-06-09T04:00:00Z');
    expect(etHourKeyFromDate(d)).toBe('2026-06-09T00');
  });
});

describe('pickHourByKey', () => {
  // Mirrors the real Open-Meteo shape: hours anchored to 00:00 today ET.
  const omHours = [
    { time: '2026-06-09T00:00', ambientF: 62, uv: 0 },
    { time: '2026-06-09T01:00', ambientF: 61, uv: 0 },
    { time: '2026-06-09T12:00', ambientF: 75, uv: 6 },
    { time: '2026-06-09T14:00', ambientF: 82, uv: 7 },
    { time: '2026-06-09T23:00', ambientF: 68, uv: 0 },
  ];

  it('REGRESSION: returns the current afternoon hour, not index 0 (midnight)', () => {
    // The exact bug: the old code used omHours[0] (62°F / UV 0). With a 2pm
    // "now" key, we must get the 82°F / UV 7 entry instead.
    const hit = pickHourByKey(omHours, '2026-06-09T14');
    expect(hit?.ambientF).toBe(82);
    expect(hit?.uv).toBe(7);
    expect(hit).not.toBe(omHours[0]);
  });

  it('returns midnight only when now actually is midnight', () => {
    const hit = pickHourByKey(omHours, '2026-06-09T00');
    expect(hit?.ambientF).toBe(62);
  });

  it('returns null when the now-hour is absent (e.g. stale prior-day snapshot)', () => {
    // A snapshot whose hours are all 2026-06-08 must NOT match a 2026-06-09 now.
    const stale = [
      { time: '2026-06-08T13:00', ambientF: 70 },
      { time: '2026-06-08T14:00', ambientF: 72 },
    ];
    expect(pickHourByKey(stale, '2026-06-09T14')).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(pickHourByKey([], '2026-06-09T14')).toBeNull();
  });

  it('does not false-match a same-hour-different-day entry', () => {
    // Date is part of the key, so 14:00 yesterday != 14:00 today.
    const hit = pickHourByKey(
      [{ time: '2026-06-08T14:00', ambientF: 999 }],
      '2026-06-09T14',
    );
    expect(hit).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { buildUserMessage, computeWqFreshness } from './interpret-location';
import type { InterpretLocationInput } from './interpret-location';
import { computeLocationHashForTest } from '@/lib/ai/get-or-generate';
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt';

// ─── computeWqFreshness ────────────────────────────────────────────────────────

describe('computeWqFreshness', () => {
  it('returns "current" for 0 days old', () => {
    expect(computeWqFreshness(0)).toBe('current');
  });

  it('returns "current" for 6 days old', () => {
    expect(computeWqFreshness(6)).toBe('current');
  });

  it('returns "recent" for 7 days old', () => {
    expect(computeWqFreshness(7)).toBe('recent');
  });

  it('returns "recent" for 14 days old', () => {
    expect(computeWqFreshness(14)).toBe('recent');
  });

  it('returns "stale" for 15 days old', () => {
    expect(computeWqFreshness(15)).toBe('stale');
  });

  it('returns "stale" for 90 days old', () => {
    expect(computeWqFreshness(90)).toBe('stale');
  });
});

// ─── buildUserMessage — water quality section ─────────────────────────────────

const baseInput: InterpretLocationInput = {
  date: '2026-05-25',
  mode: 'observed',
  forecastConfidence: null,
  daysOut: 0,
  locationSlug: 'pony-pasture',
  locationName: 'Pony Pasture Rapids',
  ageBucket: '6-9',
  gageFt: 3.5,
  dischargeCfs: 1100,
  waterTempF: 70,
  airTempF: 82,
  precip24hIn: 0,
  dataAgeMinutes: 15,
  activeAdvisoryHeadlines: [],
  availableActivitySlugs: ['swim', 'rock-hop', 'beach-access', 'hike'],
  waterQuality: null,
  upstreamCso: null,
};

describe('buildUserMessage — water quality section', () => {
  it('shows "No JRA station mapped" when waterQuality is null', () => {
    const msg = buildUserMessage({ ...baseInput, waterQuality: null });
    expect(msg).toContain('No JRA station mapped for this location.');
  });

  it('shows "no sample within 14-day recency window" when primaryStation is null', () => {
    const msg = buildUserMessage({
      ...baseInput,
      waterQuality: { primaryStation: null, watchStation: null },
    });
    expect(msg).toContain('no sample within the 14-day recency window');
  });

  it('renders primary station E. coli and freshness', () => {
    const msg = buildUserMessage({
      ...baseInput,
      waterQuality: {
        primaryStation: {
          stationCode: 'J23',
          stationName: 'Pony Pasture',
          ecoliCfuPer100ml: 88,
          enterococciCfuPer100ml: null,
          daysOld: 3,
          freshness: 'current',
          testsEnterococcus: false,
        },
        watchStation: null,
      },
    });
    expect(msg).toContain('J23');
    expect(msg).toContain('88 CFU/100mL');
    expect(msg).toContain('3 days (current)');
    expect(msg).toContain('not tested (E. coli–only station)');
  });

  it('shows "not measured in this sample" when ecoli is null', () => {
    const msg = buildUserMessage({
      ...baseInput,
      waterQuality: {
        primaryStation: {
          stationCode: 'J23',
          stationName: 'Pony Pasture',
          ecoliCfuPer100ml: null,
          enterococciCfuPer100ml: null,
          daysOld: 5,
          freshness: 'current',
          testsEnterococcus: false,
        },
        watchStation: null,
      },
    });
    expect(msg).toContain('not measured in this sample');
  });

  it('renders watch station line when provided', () => {
    const msg = buildUserMessage({
      ...baseInput,
      waterQuality: {
        primaryStation: {
          stationCode: 'J23',
          stationName: 'Pony Pasture',
          ecoliCfuPer100ml: 50,
          enterococciCfuPer100ml: null,
          daysOld: 2,
          freshness: 'current',
          testsEnterococcus: false,
        },
        watchStation: {
          stationCode: 'J24',
          stationName: 'Huguenot Flatwater',
          ecoliCfuPer100ml: 120,
          daysOld: 2,
          freshness: 'current',
        },
      },
    });
    expect(msg).toContain('J24');
    expect(msg).toContain('Huguenot Flatwater');
    expect(msg).toContain('120 CFU/100mL');
  });

  it('renders enterococcus line for dual-bacteria stations', () => {
    const msg = buildUserMessage({
      ...baseInput,
      waterQuality: {
        primaryStation: {
          stationCode: 'J99',
          stationName: 'Future Station',
          ecoliCfuPer100ml: 80,
          enterococciCfuPer100ml: 55,
          daysOld: 1,
          freshness: 'current',
          testsEnterococcus: true,
        },
        watchStation: null,
      },
    });
    expect(msg).toContain('55 CFU/100mL');
    expect(msg).not.toContain('not tested');
  });

  it('renders "1 day" singular', () => {
    const msg = buildUserMessage({
      ...baseInput,
      waterQuality: {
        primaryStation: {
          stationCode: 'J23',
          stationName: 'Pony Pasture',
          ecoliCfuPer100ml: 10,
          enterococciCfuPer100ml: null,
          daysOld: 1,
          freshness: 'current',
          testsEnterococcus: false,
        },
        watchStation: null,
      },
    });
    expect(msg).toContain('1 day (current)');
  });
});

// ─── buildUserMessage — severe weather directive ─────────────────────────────

describe('buildUserMessage — severe weather directive', () => {
  it('omits the directive when severeWeather is absent', () => {
    const msg = buildUserMessage(baseInput);
    expect(msg).not.toContain('SEVERE WEATHER');
    expect(msg).not.toContain('Do NOT recommend any activities');
  });

  it('omits the directive for tier "none"', () => {
    const msg = buildUserMessage({ ...baseInput, severeWeather: { tier: 'none', message: '' } });
    expect(msg).not.toContain('SEVERE WEATHER');
  });

  it('emits the directive and the safety message under a watch', () => {
    const msg = buildUserMessage({
      ...baseInput,
      severeWeather: {
        tier: 'watch',
        message: 'Severe weather watch in effect — not a good day for the river.',
      },
    });
    expect(msg).toContain('SEVERE WEATHER');
    expect(msg).toContain('Do NOT recommend any activities');
    expect(msg).toContain('Severe weather watch in effect');
  });
});

// ─── buildUserMessage — mode rendering ───────────────────────────────────────

describe('buildUserMessage — mode rendering', () => {
  it('uses "Current conditions" header and "Mode: observed" for observed mode', () => {
    const msg = buildUserMessage({ ...baseInput, mode: 'observed', forecastConfidence: null, daysOut: 0 });
    expect(msg).toContain('Mode: observed');
    expect(msg).toContain('--- Current conditions ---');
    expect(msg).not.toContain('Forecast conditions');
  });

  it('uses "Forecast conditions (day +2)" header and medium-confidence mode label', () => {
    const msg = buildUserMessage({
      ...baseInput,
      date: '2026-05-27',
      mode: 'forecast',
      forecastConfidence: 'medium',
      daysOut: 2,
      waterTempF: null,
      dataAgeMinutes: null,
    });
    expect(msg).toContain('Mode: forecast (medium confidence, day +2)');
    expect(msg).toContain('--- Forecast conditions (day +2) ---');
    expect(msg).not.toContain('Current conditions');
  });

  it('omits water temp and data age lines for forecast mode', () => {
    const msg = buildUserMessage({
      ...baseInput,
      date: '2026-05-28',
      mode: 'forecast',
      forecastConfidence: 'low',
      daysOut: 3,
      waterTempF: null,
      dataAgeMinutes: null,
    });
    expect(msg).not.toContain('Water temp:');
    expect(msg).not.toContain('Data age:');
    // Gage height should still be present
    expect(msg).toContain('Gage height:');
  });

  it('includes water temp and data age for observed mode', () => {
    const msg = buildUserMessage({ ...baseInput, mode: 'observed', forecastConfidence: null, daysOut: 0 });
    expect(msg).toContain('Water temp:');
    expect(msg).toContain('Data age:');
  });
});

// ─── buildUserMessage — CSO section (observed mode) ──────────────────────────

describe('buildUserMessage — CSO section (observed mode)', () => {
  it('emits "no active events" when upstreamCso is null', () => {
    const msg = buildUserMessage({ ...baseInput, upstreamCso: null });
    expect(msg).toContain('Upstream CSO: no active events in past 72h.');
  });

  it('emits "no active events" when upstreamCso.count === 0', () => {
    const msg = buildUserMessage({
      ...baseInput,
      upstreamCso: { count: 0, mostRecentAt: null },
    });
    expect(msg).toContain('Upstream CSO: no active events in past 72h.');
  });

  it('reports count, approximate timing, and caution when count > 0', () => {
    const mostRecentAt = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const msg = buildUserMessage({
      ...baseInput,
      upstreamCso: { count: 2, mostRecentAt },
    });
    expect(msg).toContain('2 events upstream in past 72h');
    expect(msg).toContain('~6h ago');
    expect(msg).toContain('caution for swim/wade');
  });

  it('singular count renders without trailing "s"', () => {
    const msg = buildUserMessage({
      ...baseInput,
      upstreamCso: { count: 1, mostRecentAt: new Date(Date.now() - 12 * 3_600_000).toISOString() },
    });
    expect(msg).toContain('1 event upstream in past 72h');
    expect(msg).not.toContain('1 events upstream');
  });

  it('NEVER includes outfall IDs — no "CSO N" pattern in output', () => {
    const msg = buildUserMessage({
      ...baseInput,
      upstreamCso: { count: 3, mostRecentAt: new Date(Date.now() - 4 * 3_600_000).toISOString() },
    });
    // The count-only shape guarantees no outfall name can appear
    expect(msg).not.toMatch(/CSO\s*\d+/i);
  });

  it('does NOT emit advisory-window language in observed mode', () => {
    const msg = buildUserMessage({
      ...baseInput,
      mode: 'observed',
      upstreamCso: { count: 1, mostRecentAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
    });
    expect(msg).not.toContain('will cover the selected date');
    expect(msg).toContain('in past 72h');
  });
});

// ─── buildUserMessage — CSO section (forecast mode) ──────────────────────────

describe('buildUserMessage — CSO section (forecast mode)', () => {
  const forecastBase: InterpretLocationInput = {
    ...baseInput,
    mode: 'forecast',
    forecastConfidence: 'high',
    daysOut: 1,
    waterTempF: null,
    dataAgeMinutes: null,
  };

  it('emits "no active events" when upstreamCso is null in forecast mode', () => {
    const msg = buildUserMessage({ ...forecastBase, upstreamCso: null });
    expect(msg).toContain('Upstream CSO: no active events in past 72h.');
  });

  it('emits advisory-window language for forecast mode with active CSO', () => {
    const msg = buildUserMessage({
      ...forecastBase,
      upstreamCso: { count: 2, mostRecentAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
    });
    expect(msg).toContain('will cover the selected date');
    expect(msg).not.toContain('in past 72h');
    expect(msg).not.toContain('~6h ago');
  });

  it('uses singular "advisory" for count === 1 in forecast mode', () => {
    const msg = buildUserMessage({
      ...forecastBase,
      upstreamCso: { count: 1, mostRecentAt: null },
    });
    expect(msg).toContain('1 overflow advisory');
    expect(msg).not.toContain('1 overflow advisories');
  });

  it('uses plural "advisories" for count > 1 in forecast mode', () => {
    const msg = buildUserMessage({
      ...forecastBase,
      upstreamCso: { count: 3, mostRecentAt: null },
    });
    expect(msg).toContain('3 overflow advisories');
  });

  it('NEVER includes outfall IDs in forecast mode either', () => {
    const msg = buildUserMessage({
      ...forecastBase,
      upstreamCso: { count: 3, mostRecentAt: null },
    });
    expect(msg).not.toMatch(/CSO\s*\d+/i);
  });
});

// ─── System prompt — CSO REASONING block ─────────────────────────────────────

describe('SYSTEM_PROMPT — CSO REASONING block', () => {
  it('contains the "Never surface outfall IDs" rule', () => {
    expect(SYSTEM_PROMPT).toContain('Never surface outfall IDs');
  });

  it('prohibits "CSO 34" as an example of what not to say', () => {
    // The system prompt must document the prohibition with the canonical example
    expect(SYSTEM_PROMPT).toContain('"CSO 34"');
  });

  it('contains mode=observed tense guidance', () => {
    expect(SYSTEM_PROMPT).toContain('mode=observed');
  });

  it('contains mode=forecast tense guidance', () => {
    expect(SYSTEM_PROMPT).toContain('mode=forecast');
  });

  it('instructs future-conditional tense for forecast CSO', () => {
    expect(SYSTEM_PROMPT).toContain('Future-conditional tense');
  });
});

// ─── computeLocationHashForTest — CSO hash stability ─────────────────────────

describe('computeLocationHashForTest — CSO hash stability', () => {
  const base: InterpretLocationInput = {
    ...baseInput,
    upstreamCso: null,
  };

  it('produces identical hashes for identical inputs (stability)', () => {
    const h1 = computeLocationHashForTest(base);
    const h2 = computeLocationHashForTest({ ...base });
    expect(h1).toBe(h2);
  });

  it('hash changes when upstreamCso count goes 0→1', () => {
    const h0 = computeLocationHashForTest({ ...base, upstreamCso: null });
    const h1 = computeLocationHashForTest({
      ...base,
      upstreamCso: { count: 1, mostRecentAt: '2026-05-29T10:00:00Z' },
    });
    expect(h0).not.toBe(h1);
  });

  it('hash changes when upstreamCso.mostRecentAt changes', () => {
    const h1 = computeLocationHashForTest({
      ...base,
      upstreamCso: { count: 1, mostRecentAt: '2026-05-29T06:00:00Z' },
    });
    const h2 = computeLocationHashForTest({
      ...base,
      upstreamCso: { count: 1, mostRecentAt: '2026-05-29T12:00:00Z' },
    });
    expect(h1).not.toBe(h2);
  });

  it('hash stays stable regardless of count when mostRecentAt is the same', () => {
    // Count changes SHOULD change the hash (different prompt text)
    const h1 = computeLocationHashForTest({
      ...base,
      upstreamCso: { count: 1, mostRecentAt: '2026-05-29T06:00:00Z' },
    });
    const h2 = computeLocationHashForTest({
      ...base,
      upstreamCso: { count: 3, mostRecentAt: '2026-05-29T06:00:00Z' },
    });
    expect(h1).not.toBe(h2);
  });
});

// ─── computeLocationHashForTest — SEC-3(b) sensor quantization ────────────────
// Sensor scalars are quantized before hashing (gageFt 0.25 ft, discharge
// 500 cfs, temps 2°F, precip 0.1 in) so a 15-min USGS tick — or an attacker
// replaying one — no longer busts the cache.

describe('computeLocationHashForTest — sensor quantization (SEC-3)', () => {
  it('a gage tick below the 0.25 ft step does not change the hash', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, gageFt: 3.5 });
    const h2 = computeLocationHashForTest({ ...baseInput, gageFt: 3.55 });
    expect(h1).toBe(h2);
  });

  it('a gage move across the 0.25 ft step changes the hash', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, gageFt: 3.5 });
    const h2 = computeLocationHashForTest({ ...baseInput, gageFt: 3.9 });
    expect(h1).not.toBe(h2);
  });

  it('a discharge tick within the 500 cfs band does not change the hash', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, dischargeCfs: 1100 });
    const h2 = computeLocationHashForTest({ ...baseInput, dischargeCfs: 1180 });
    expect(h1).toBe(h2);
  });

  it('a discharge move across the 500 cfs band changes the hash', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, dischargeCfs: 1100 });
    const h2 = computeLocationHashForTest({ ...baseInput, dischargeCfs: 1300 });
    expect(h1).not.toBe(h2);
  });

  it('air temp ticks within the 2°F band do not change the hash', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, airTempF: 82 });
    const h2 = computeLocationHashForTest({ ...baseInput, airTempF: 82.6 });
    expect(h1).toBe(h2);
  });

  it('precip ticks below 0.05 in do not change the hash', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, precip24hIn: 0 });
    const h2 = computeLocationHashForTest({ ...baseInput, precip24hIn: 0.04 });
    expect(h1).toBe(h2);
  });

  it('null sensor values hash stably', () => {
    const h1 = computeLocationHashForTest({ ...baseInput, gageFt: null, waterTempF: null });
    const h2 = computeLocationHashForTest({ ...baseInput, gageFt: null, waterTempF: null });
    expect(h1).toBe(h2);
  });
});

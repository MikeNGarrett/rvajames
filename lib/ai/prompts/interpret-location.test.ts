import { describe, it, expect } from 'vitest';
import { buildUserMessage, computeWqFreshness } from './interpret-location';
import type { InterpretLocationInput } from './interpret-location';

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

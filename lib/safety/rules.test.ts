import { describe, it, expect } from 'vitest';
import {
  gageHeightStatus,
  postRainSwimStatus,
  csoAdvisoryStatus,
  bacterialStatus,
  waterTempStatus,
  combinedLocationStatus,
} from './rules';

// ─── gageHeightStatus ─────────────────────────────────────────────────────────

describe('gageHeightStatus', () => {
  it('returns safe at normal gage (≤ 4.0 ft)', () => {
    expect(gageHeightStatus(2.5)).toBe('safe');
    expect(gageHeightStatus(3.69)).toBe('safe');
    expect(gageHeightStatus(4.0)).toBe('safe');
  });

  it('returns caution in elevated range (4.1–5.5 ft)', () => {
    expect(gageHeightStatus(4.1)).toBe('caution');
    expect(gageHeightStatus(5.0)).toBe('caution');
    expect(gageHeightStatus(5.5)).toBe('caution');
  });

  it('returns danger above high threshold (> 8.0 ft)', () => {
    expect(gageHeightStatus(8.1)).toBe('danger');
    expect(gageHeightStatus(12.0)).toBe('danger');
    expect(gageHeightStatus(25.0)).toBe('danger');
  });

  it('returns caution for elevated range (5.6–8.0 ft)', () => {
    expect(gageHeightStatus(6.0)).toBe('caution');
    expect(gageHeightStatus(7.5)).toBe('caution');
    expect(gageHeightStatus(8.0)).toBe('caution');
  });

  it('returns unknown for null gage', () => {
    expect(gageHeightStatus(null)).toBe('unknown');
  });
});

// ─── postRainSwimStatus ───────────────────────────────────────────────────────

describe('postRainSwimStatus', () => {
  it('returns safe with no rain', () => {
    expect(postRainSwimStatus(0)).toBe('safe');
    expect(postRainSwimStatus(0.1)).toBe('safe');
    expect(postRainSwimStatus(null)).toBe('safe');
  });

  it('returns caution at exactly the trigger threshold (0.5 in)', () => {
    expect(postRainSwimStatus(0.5)).toBe('caution');
  });

  it('returns caution above the trigger threshold', () => {
    expect(postRainSwimStatus(0.6)).toBe('caution');
    expect(postRainSwimStatus(1.5)).toBe('caution');
    expect(postRainSwimStatus(3.0)).toBe('caution');
  });
});

// ─── csoAdvisoryStatus ────────────────────────────────────────────────────────

describe('csoAdvisoryStatus', () => {
  it('returns safe with no advisories', () => {
    expect(csoAdvisoryStatus([])).toBe('safe');
  });

  it('returns safe with non-CSO advisories', () => {
    expect(
      csoAdvisoryStatus([{ kind: 'flood_watch' }, { kind: 'water_quality' }]),
    ).toBe('safe');
  });

  it('returns danger with an active CSO advisory', () => {
    expect(csoAdvisoryStatus([{ kind: 'cso_overflow' }])).toBe('danger');
  });

  it('returns danger with CSO among other advisories', () => {
    expect(
      csoAdvisoryStatus([{ kind: 'flood_watch' }, { kind: 'cso_overflow' }]),
    ).toBe('danger');
  });
});

// ─── bacterialStatus ─────────────────────────────────────────────────────────

describe('bacterialStatus', () => {
  it('returns safe below 235 CFU', () => {
    expect(bacterialStatus(0)).toBe('safe');
    expect(bacterialStatus(100)).toBe('safe');
    expect(bacterialStatus(234)).toBe('safe');
  });

  it('returns caution at the Virginia DEQ threshold (235 CFU)', () => {
    expect(bacterialStatus(235)).toBe('caution');
    expect(bacterialStatus(500)).toBe('caution');
    expect(bacterialStatus(999)).toBe('caution');
  });

  it('returns danger above 1000 CFU', () => {
    expect(bacterialStatus(1000)).toBe('danger');
    expect(bacterialStatus(5000)).toBe('danger');
  });

  it('returns unknown for null', () => {
    expect(bacterialStatus(null)).toBe('unknown');
  });
});

// ─── waterTempStatus ─────────────────────────────────────────────────────────

describe('waterTempStatus', () => {
  it('returns danger below 50°F (cold shock risk)', () => {
    expect(waterTempStatus(32)).toBe('danger');
    expect(waterTempStatus(45)).toBe('danger');
    expect(waterTempStatus(49)).toBe('danger');
  });

  it('returns caution in 50–59°F range', () => {
    expect(waterTempStatus(50)).toBe('caution');
    expect(waterTempStatus(55)).toBe('caution');
    expect(waterTempStatus(59)).toBe('caution');
  });

  it('returns safe at 60°F and above', () => {
    expect(waterTempStatus(60)).toBe('safe');
    expect(waterTempStatus(72)).toBe('safe');
    expect(waterTempStatus(85)).toBe('safe');
  });

  it('returns unknown for null', () => {
    expect(waterTempStatus(null)).toBe('unknown');
  });
});

// ─── combinedLocationStatus ───────────────────────────────────────────────────

describe('combinedLocationStatus', () => {
  const noAdvisories: never[] = [];

  it('returns safe at normal gage with no advisories', () => {
    const result = combinedLocationStatus({ gageFt: 3.5 }, noAdvisories, 'belle-isle');
    expect(result.status).toBe('safe');
    expect(result.reason).toMatch(/normal range/i);
  });

  it('returns caution at elevated gage', () => {
    const result = combinedLocationStatus({ gageFt: 5.0 }, noAdvisories, 'pony-pasture');
    expect(result.status).toBe('caution');
  });

  it('returns danger at high gage', () => {
    const result = combinedLocationStatus({ gageFt: 9.0 }, noAdvisories, 'texas-beach');
    expect(result.status).toBe('danger');
  });

  it('returns danger for Browns Island at flood stage (10+ ft)', () => {
    const result = combinedLocationStatus({ gageFt: 10.5 }, noAdvisories, 'browns-island');
    expect(result.status).toBe('danger');
    expect(result.reason).toMatch(/closes this location/i);
  });

  it('returns danger on active CSO advisory regardless of gage', () => {
    const result = combinedLocationStatus(
      { gageFt: 2.5 },
      [{ kind: 'cso_overflow', severity: 'high', headline: 'CSO active' }],
      'belle-isle',
    );
    expect(result.status).toBe('danger');
  });

  it('escalates to danger on high-severity advisory', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.0 },
      [{ kind: 'flood_watch', severity: 'high', headline: 'Flood watch in effect' }],
      'pony-pasture',
    );
    expect(result.status).toBe('danger');
  });

  it('returns caution after significant rainfall', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.0, precip48hIn: 0.8 },
      noAdvisories,
      'texas-beach',
    );
    expect(result.status).toBe('caution');
  });
});

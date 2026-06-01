/**
 * Wet-bulb + heat-stress-zone tests.
 *
 * Reference values cross-checked against multiple online wet-bulb
 * calculators (NOAA, weather.gov, Iowa State Mesonet). Stull's
 * approximation is accurate within ±0.5°C so we allow ±1°F slack.
 */

import { describe, it, expect } from 'vitest';
import { wetBulbF, heatStressZone } from './wet-bulb';

describe('wetBulbF — Stull approximation', () => {
  // Stull (2011) is accurate within ±0.5°C (≈ ±0.9°F). Test tolerances
  // are ±1°F to leave room for that accuracy + rounding. Cross-checked
  // against the Iowa State Mesonet wet-bulb calculator.

  it('moderate heat + humidity: 85°F + 60% RH ≈ 74°F', () => {
    const tw = wetBulbF(85, 60);
    expect(tw).toBeGreaterThanOrEqual(73);
    expect(tw).toBeLessThanOrEqual(75);
  });

  it('high humidity, hot: 95°F + 80% RH ≈ 89-90°F (danger zone)', () => {
    // High wet bulb at high temp + high humidity is the dangerous
    // combo Stull's approximation was designed to capture.
    const tw = wetBulbF(95, 80);
    expect(tw).toBeGreaterThanOrEqual(88);
    expect(tw).toBeLessThanOrEqual(91);
  });

  it('low humidity, hot: 100°F + 20% RH ≈ 70°F', () => {
    // Even at very hot ambient, low RH keeps wet bulb low — sweat
    // evaporates efficiently. Physiologically tolerable.
    const tw = wetBulbF(100, 20);
    expect(tw).toBeGreaterThanOrEqual(69);
    expect(tw).toBeLessThanOrEqual(71);
  });

  it('mild day: 70°F + 50% RH ≈ 58°F', () => {
    const tw = wetBulbF(70, 50);
    expect(tw).toBeGreaterThanOrEqual(57);
    expect(tw).toBeLessThanOrEqual(59);
  });

  it('cool morning: 50°F + 70% RH ≈ 44-45°F', () => {
    const tw = wetBulbF(50, 70);
    expect(tw).toBeGreaterThanOrEqual(43.5);
    expect(tw).toBeLessThanOrEqual(46);
  });

  it('saturated air (100% RH) returns ≈ ambient temp', () => {
    // At saturation, wet bulb = dry bulb (no evaporative cooling possible).
    expect(wetBulbF(80, 100)).toBeCloseTo(80, 0);
    expect(wetBulbF(60, 100)).toBeCloseTo(60, 0);
  });
});

describe('heatStressZone — band boundaries', () => {
  it('normal: < 80°F', () => {
    expect(heatStressZone(70)).toBe('normal');
    expect(heatStressZone(79.9)).toBe('normal');
  });

  it('caution: 80–84.99°F', () => {
    expect(heatStressZone(80)).toBe('caution');
    expect(heatStressZone(84.9)).toBe('caution');
  });

  it('extreme: 85–87.99°F', () => {
    expect(heatStressZone(85)).toBe('extreme');
    expect(heatStressZone(87.9)).toBe('extreme');
  });

  it('danger: 88–89.99°F', () => {
    expect(heatStressZone(88)).toBe('danger');
    expect(heatStressZone(89.9)).toBe('danger');
  });

  it('avoid: ≥ 90°F', () => {
    expect(heatStressZone(90)).toBe('avoid');
    expect(heatStressZone(95)).toBe('avoid');
    expect(heatStressZone(110)).toBe('avoid');
  });

  it('handles wet bulb derived from realistic combos', () => {
    // Composed call: hot humid day → high wet bulb → danger zone.
    const tw = wetBulbF(95, 80);
    expect(heatStressZone(tw)).toBe('danger');
  });

  it('handles wet bulb derived from low-humidity hot day → normal', () => {
    const tw = wetBulbF(100, 20);
    expect(heatStressZone(tw)).toBe('normal');
  });
});

import { describe, it, expect } from 'vitest';
import {
  gageHeightStatus,
  postRainSwimStatus,
  csoAdvisoryStatus,
  bacterialStatus,
  waterTempStatus,
  combinedLocationStatus,
  rapidsClass,
  riverWideActivityStatuses,
  riverConditionSummary,
  type RiverConditionInput,
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

// ─── rapidsClass ──────────────────────────────────────────────────────────────

describe('rapidsClass', () => {
  // Band 1: ≤ 4.0 → I-II
  it('returns I-II at low-normal gage (2.5 ft)', () => {
    expect(rapidsClass(2.5)).toMatchObject({ class: 'I-II', label: 'Beginner friendly' });
  });
  it('returns I-II at exactly 4.0 ft (boundary)', () => {
    expect(rapidsClass(4.0).class).toBe('I-II');
  });
  it('returns II-III just above 4.0 ft (4.1)', () => {
    expect(rapidsClass(4.1).class).toBe('II-III');
  });

  // Band 2: 4.1–5.5 → II-III
  it('returns II-III at 5.0 ft (mid-elevated)', () => {
    expect(rapidsClass(5.0)).toMatchObject({ class: 'II-III', label: 'Intermediate' });
  });
  it('returns II-III at exactly 5.5 ft (boundary)', () => {
    expect(rapidsClass(5.5).class).toBe('II-III');
  });
  it('returns III-IV just above 5.5 ft (5.6)', () => {
    expect(rapidsClass(5.6).class).toBe('III-IV');
  });

  // Band 3: 5.6–8.0 → III-IV
  it('returns III-IV at 7.0 ft', () => {
    expect(rapidsClass(7.0)).toMatchObject({ class: 'III-IV', label: 'Experienced' });
  });
  it('returns III-IV at exactly 8.0 ft (boundary)', () => {
    expect(rapidsClass(8.0).class).toBe('III-IV');
  });
  it('returns IV-V just above 8.0 ft (8.1)', () => {
    expect(rapidsClass(8.1).class).toBe('IV-V');
  });

  // Band 4: > 8.0 → IV-V
  it('returns IV-V at 12 ft (flood stage)', () => {
    expect(rapidsClass(12.0)).toMatchObject({ class: 'IV-V', label: 'Expert only / avoid' });
  });
  it('returns IV-V at extreme flood (25 ft)', () => {
    expect(rapidsClass(25.0).class).toBe('IV-V');
  });
});

// ─── riverWideActivityStatuses ────────────────────────────────────────────────

const baseInput = {
  waterTempF: 74,
  rain48hIn: 0,
  activeCSOAdvisory: false,
  hasHighSeverityAdvisory: false,
};

describe('riverWideActivityStatuses', () => {
  it('returns exactly 4 entries in canonical order', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.1 });
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.slug)).toEqual([
      'swimming', 'rock-hopping', 'kayaking-whitewater', 'hiking',
    ]);
  });

  // ── Swimming ──
  it('swimming: safe at normal gage with warm water', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.5 });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('safe');
  });
  it('swimming: caution when water temp below 60°F', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.5, waterTempF: 55 });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('caution');
  });
  it('swimming: caution at elevated gage (4.1–5.5 ft)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 5.0 });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('caution');
  });
  it('swimming: deny above 5.5 ft', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 6.0 });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('deny');
  });
  it('swimming: deny on active CSO advisory', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.0, activeCSOAdvisory: true });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('deny');
  });
  it('swimming: deny after rain 0.5+ in 48h', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.0, rain48hIn: 0.6 });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('deny');
  });

  // ── Rock-hopping ──
  it('rock-hopping: safe at low gage (≤ 3.5 ft)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.0 });
    expect(result.find((r) => r.slug === 'rock-hopping')?.status).toBe('safe');
  });
  it('rock-hopping: caution between 3.5 and 4.5 ft', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 4.0 });
    expect(result.find((r) => r.slug === 'rock-hopping')?.status).toBe('caution');
  });
  it('rock-hopping: deny at 4.5 ft (rocks submerged)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 4.5 });
    expect(result.find((r) => r.slug === 'rock-hopping')?.status).toBe('deny');
  });

  // ── Kayaking ──
  it('kayaking: caution when gage < 3.0 ft (low flow)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 2.0 });
    expect(result.find((r) => r.slug === 'kayaking-whitewater')?.status).toBe('caution');
  });
  it('kayaking: safe at normal flow (3.0–5.5 ft)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 4.0 });
    expect(result.find((r) => r.slug === 'kayaking-whitewater')?.status).toBe('safe');
  });
  it('kayaking: caution at Class III range (5.6–8.0 ft)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 6.0 });
    expect(result.find((r) => r.slug === 'kayaking-whitewater')?.status).toBe('caution');
  });
  it('kayaking: deny above 8.0 ft', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 9.0 });
    expect(result.find((r) => r.slug === 'kayaking-whitewater')?.status).toBe('deny');
  });

  // ── Hiking ──
  it('hiking: safe at normal gage', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.5 });
    expect(result.find((r) => r.slug === 'hiking')?.status).toBe('safe');
  });
  it('hiking: caution on high-severity advisory', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 3.5, hasHighSeverityAdvisory: true });
    expect(result.find((r) => r.slug === 'hiking')?.status).toBe('caution');
  });
  it('hiking: deny above flood threshold (> 11 ft)', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 12.0 });
    expect(result.find((r) => r.slug === 'hiking')?.status).toBe('deny');
  });

  // ── Canonical smoke test ──
  it('gage 6.0: swimming deny, rock-hopping deny, kayaking caution, hiking safe', () => {
    const result = riverWideActivityStatuses({ ...baseInput, upriverGageFt: 6.0 });
    expect(result.find((r) => r.slug === 'swimming')?.status).toBe('deny');
    expect(result.find((r) => r.slug === 'rock-hopping')?.status).toBe('deny');
    expect(result.find((r) => r.slug === 'kayaking-whitewater')?.status).toBe('caution');
    expect(result.find((r) => r.slug === 'hiking')?.status).toBe('safe');
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

  // ── Operational status overrides (sub-goal 43) ─────────────────────────────

  it('closed kind → status=closed, overrides good weather', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.5 },
      noAdvisories,
      'belle-isle',
      { kind: 'closed', reason: 'Bridge washed out', affects: null },
    );
    expect(result.status).toBe('closed');
    expect(result.label).toBe('Access closed');
    expect(result.reason).toContain('Bridge washed out');
  });

  it('closed_indefinite kind → status=closed, includes affects scope', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.5 },
      noAdvisories,
      'texas-beach',
      { kind: 'closed_indefinite', reason: 'RVA.gov advisory 2026-05-22', affects: 'Pedestrian bridge' },
    );
    expect(result.status).toBe('closed');
    expect(result.reason).toContain('Pedestrian bridge');
    expect(result.reason).toContain('RVA.gov advisory 2026-05-22');
  });

  it('closed kind → overrides danger weather status', () => {
    const result = combinedLocationStatus(
      { gageFt: 9.5 },   // above flood_close threshold for most locations
      noAdvisories,
      'belle-isle',
      { kind: 'closed', reason: 'Maintenance closure', affects: null },
    );
    expect(result.status).toBe('closed');
  });

  it('restricted kind → caution or worse, reason includes restriction note', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.5 },   // normal conditions
      noAdvisories,
      'pony-pasture',
      { kind: 'restricted', reason: 'Trail section closed', affects: 'South trail' },
    );
    expect(result.status).toBe('caution');
    expect(result.reason).toContain('South trail');
    expect(result.reason).toContain('restricted');
  });

  it('restricted kind with danger weather → still danger', () => {
    const result = combinedLocationStatus(
      { gageFt: 9.5 },
      noAdvisories,
      'pony-pasture',
      { kind: 'restricted', reason: 'Partial closure', affects: null },
    );
    expect(result.status).toBe('danger');
  });

  it('open kind → no override, passes through weather status', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.5 },
      noAdvisories,
      'belle-isle',
      { kind: 'open', reason: 'All clear', affects: null },
    );
    expect(result.status).toBe('safe');
  });

  it('expired/null operationalStatus → no override', () => {
    const result = combinedLocationStatus(
      { gageFt: 3.5 },
      noAdvisories,
      'belle-isle',
      null,
    );
    expect(result.status).toBe('safe');
  });
});

// ─── riverConditionSummary (sub-goal 37) ─────────────────────────────────────

const baseRiverInput: RiverConditionInput = {
  currentGageFt:          3.69,
  dischargeNormal:        { p25: 2800, p50: 5500, p75: 9800, unit: 'cfs' },
  currentDischargeCfs:    5200,
  rapidsClass:            'I-II',
  activeAdvisorySeverity: null,
  ageBucket:              null,
};

describe('riverConditionSummary', () => {
  // ── Band detection ──────────────────────────────────────────────────────────

  it('gage 2.0 → band low', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 2.0 });
    expect(r.band).toBe('low');
    expect(r.headline).toBe('Low & Slow');
    expect(r.status).toBe('safe');
  });

  it('gage 2.5 → band low (boundary)', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 2.5 });
    expect(r.band).toBe('low');
  });

  it('gage 2.6 → band normal (just above low threshold)', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 2.6 });
    expect(r.band).toBe('normal');
  });

  it('gage 3.69 → band normal', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 3.69 });
    expect(r.band).toBe('normal');
    expect(r.headline).toBe('Calm & Normal');
    expect(r.status).toBe('safe');
  });

  it('gage 4.0 → band normal (boundary)', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 4.0 });
    expect(r.band).toBe('normal');
  });

  it('gage 4.1 → band elevated', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 4.1 });
    expect(r.band).toBe('elevated');
    expect(r.status).toBe('caution');
  });

  it('gage 5.5 → band elevated (boundary)', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 5.5 });
    expect(r.band).toBe('elevated');
  });

  it('gage 5.6 → band high', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 5.6 });
    expect(r.band).toBe('high');
    expect(r.status).toBe('caution');
  });

  it('gage 8.0 → band high (boundary)', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 8.0 });
    expect(r.band).toBe('high');
  });

  it('gage 8.1 → band flood', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 8.1 });
    expect(r.band).toBe('flood');
    expect(r.status).toBe('danger');
  });

  it('gage 25.0 → band flood (extreme)', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 25 });
    expect(r.band).toBe('flood');
    expect(r.status).toBe('danger');
  });

  // ── Delta label ─────────────────────────────────────────────────────────────

  it('discharge near median → deltaLabel "near seasonal median flow"', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentDischargeCfs: 5500, // exactly p50
    });
    expect(r.deltaLabel).toBe('near seasonal median flow');
  });

  it('discharge above median → deltaLabel shows above', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentDischargeCfs: 8000, // 2,500 above p50=5500
    });
    expect(r.deltaLabel).toMatch(/above seasonal median/);
  });

  it('discharge below median → deltaLabel shows below', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentDischargeCfs: 3000, // 2,500 below p50=5500
    });
    expect(r.deltaLabel).toMatch(/below seasonal median/);
  });

  it('no discharge data → deltaLabel is null', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      dischargeNormal:     null,
      currentDischargeCfs: null,
    });
    expect(r.deltaLabel).toBeNull();
  });

  it('discharge present but currentDischargeCfs null → deltaLabel is null', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentDischargeCfs: null,
    });
    expect(r.deltaLabel).toBeNull();
  });

  // ── Advisory override ────────────────────────────────────────────────────────

  it('high-severity advisory elevates status to danger regardless of band', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt:          3.5,
      activeAdvisorySeverity: 'high',
    });
    expect(r.band).toBe('normal');     // band stays normal
    expect(r.status).toBe('danger');   // but status is overridden
  });

  it('extreme advisory elevates status to danger', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt:          2.0,
      activeAdvisorySeverity: 'extreme',
    });
    expect(r.status).toBe('danger');
  });

  it('low advisory does not override status', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt:          3.5,
      activeAdvisorySeverity: 'low',
    });
    expect(r.status).toBe('safe');
  });

  // ── Child-friendly translations ──────────────────────────────────────────────

  it('ageBucket 0-2 produces child-friendly translation', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt: 3.5,
      ageBucket:     '0-2',
    });
    expect(r.translation).toMatch(/famil|gentle|wading/i);
  });

  it('ageBucket 6-9 produces child-friendly translation', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt: 6.0,
      ageBucket:     '6-9',
    });
    expect(r.translation).toMatch(/adult|shore/i);
  });

  it('ageBucket adult produces adult translation', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt: 3.5,
      ageBucket:     '18+',
    });
    expect(r.translation).toMatch(/access points|rapids|season/i);
  });

  it('null ageBucket produces adult translation', () => {
    const r = riverConditionSummary({
      ...baseRiverInput,
      currentGageFt: 3.5,
      ageBucket:     null,
    });
    expect(r.translation).toMatch(/access points|rapids|season/i);
  });

  // ── Translation content ──────────────────────────────────────────────────────

  it('flood translation warns to keep clear', () => {
    const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: 10.0 });
    expect(r.translation).toMatch(/flood/i);
  });

  it('returns a translation string of ≤18 words for every band', () => {
    const gages: [number, string][] = [
      [2.0, 'low'], [3.5, 'normal'], [5.0, 'elevated'],
      [7.0, 'high'], [9.0, 'flood'],
    ];
    for (const [gage] of gages) {
      const r = riverConditionSummary({ ...baseRiverInput, currentGageFt: gage });
      const wordCount = r.translation.split(/\s+/).length;
      expect(wordCount, `band ${r.band} translation too long (${wordCount} words)`).toBeLessThanOrEqual(18);
    }
  });
});

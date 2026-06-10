import { describe, it, expect } from 'vitest';
import { buildMetroUserMessage, type MetroSummaryInput } from './summarize-metro';
import { computeMetroHashForTest } from '@/lib/ai/get-or-generate';
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt';

// ─── Minimal MetroRiverState stub ──────────────────────────────────────────────

// Cast to avoid needing all MetroRiverState fields; buildMetroUserMessage only reads
// upriver/downriver gauge scalars and lastUpdatedAt.
const metroState = {
  upriver: {
    gageFt: 3.5,
    dischargeCfs: 1100,
    waterTempF: 72,
    fetchedAt: new Date().toISOString(),
  },
  downriver: {
    gageFt: 0.4,
    dischargeCfs: null,
    waterTempF: null,
    fetchedAt: new Date().toISOString(),
  },
  lastUpdatedAt: new Date().toISOString(),
} as unknown as MetroSummaryInput['metroState'];

const baseMetroInput: MetroSummaryInput = {
  date: '2026-05-29',
  ageBucket: '6-9',
  metroState,
  activeAdvisoryHeadlines: [],
  airTempF: 82,
  mode: 'observed',
  forecastConfidence: null,
  daysOut: 0,
  rain48hIn: 0,
  activeCSOAdvisory: false,
  hasHighSeverityAdvisory: false,
  activeClosures: [],
  // cso field omitted → no active overflows
};

// ─── buildMetroUserMessage — CSO section (observed mode) ──────────────────────

describe('buildMetroUserMessage — CSO section (observed mode)', () => {
  it('emits "no active overflows" when cso is omitted', () => {
    const msg = buildMetroUserMessage(baseMetroInput);
    expect(msg).toContain('no active overflows');
  });

  it('emits "no active overflows" when cso counts are both zero', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 0 },
        advisoriesOnSelectedDate: { count: 0, windowEndsAt: null },
      },
    });
    expect(msg).toContain('no active overflows');
  });

  it('reports active discharge count when overflows are present', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 3 },
        advisoriesOnSelectedDate: { count: 3, windowEndsAt: '2026-05-31T03:00:00Z' },
      },
    });
    expect(msg).toContain('3 overflows active');
    expect(msg).toContain('Advisory windows covering today: 3');
    expect(msg).toContain('Caution for all downstream swimming access points.');
  });

  it('renders singular overflow count correctly', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 1 },
        advisoriesOnSelectedDate: { count: 1, windowEndsAt: null },
      },
    });
    expect(msg).toContain('1 overflow active');
    expect(msg).not.toContain('1 overflows active');
  });

  it('NEVER includes outfall IDs in the prompt text — no "CSO N" pattern', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 5 },
        advisoriesOnSelectedDate: { count: 5, windowEndsAt: '2026-05-31T03:00:00Z' },
      },
    });
    expect(msg).not.toMatch(/CSO\s*\d+/i);
  });

  it('does NOT emit advisory-window language in observed mode', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      mode: 'observed',
      cso: {
        activelyDischarging: { count: 2 },
        advisoriesOnSelectedDate: { count: 2, windowEndsAt: '2026-05-31T03:00:00Z' },
      },
    });
    expect(msg).not.toContain('cover the selected date');
    expect(msg).toContain('active in Richmond metro');
  });
});

// ─── buildMetroUserMessage — CSO section (forecast mode) ──────────────────────

describe('buildMetroUserMessage — CSO section (forecast mode)', () => {
  const forecastBase: MetroSummaryInput = {
    ...baseMetroInput,
    date: '2026-05-30',
    mode: 'forecast',
    forecastConfidence: 'high',
    daysOut: 1,
  };

  it('emits advisory-window language in forecast mode with CSO', () => {
    const msg = buildMetroUserMessage({
      ...forecastBase,
      cso: {
        activelyDischarging: { count: 2 },
        advisoriesOnSelectedDate: { count: 2, windowEndsAt: '2026-05-31T03:00:00Z' },
      },
    });
    expect(msg).toContain('advisory window');
    expect(msg).toContain('the selected date');
    expect(msg).not.toContain('active in Richmond metro');
  });

  it('includes clear-by timestamp for forecast mode', () => {
    const msg = buildMetroUserMessage({
      ...forecastBase,
      cso: {
        activelyDischarging: { count: 1 },
        advisoriesOnSelectedDate: { count: 1, windowEndsAt: '2026-05-31T03:00:00Z' },
      },
    });
    expect(msg).toContain('2026-05-31T03:00:00Z');
  });

  it('uses plural "windows" for count > 1', () => {
    const msg = buildMetroUserMessage({
      ...forecastBase,
      cso: {
        activelyDischarging: { count: 3 },
        advisoriesOnSelectedDate: { count: 3, windowEndsAt: null },
      },
    });
    expect(msg).toContain('3 advisory windows');
  });

  it('uses singular "window" for count === 1', () => {
    const msg = buildMetroUserMessage({
      ...forecastBase,
      cso: {
        activelyDischarging: { count: 1 },
        advisoriesOnSelectedDate: { count: 1, windowEndsAt: null },
      },
    });
    expect(msg).toContain('1 advisory window');
    expect(msg).not.toContain('1 advisory windows');
  });

  it('NEVER includes outfall IDs in forecast mode — no "CSO N" pattern', () => {
    const msg = buildMetroUserMessage({
      ...forecastBase,
      cso: {
        activelyDischarging: { count: 4 },
        advisoriesOnSelectedDate: { count: 4, windowEndsAt: '2026-05-31T03:00:00Z' },
      },
    });
    expect(msg).not.toMatch(/CSO\s*\d+/i);
  });
});

// ─── computeMetroHashForTest — CSO hash stability ────────────────────────────

describe('computeMetroHashForTest — CSO hash stability', () => {
  it('produces identical hashes for identical inputs (stability)', () => {
    const h1 = computeMetroHashForTest(baseMetroInput);
    const h2 = computeMetroHashForTest({ ...baseMetroInput });
    expect(h1).toBe(h2);
  });

  it('hash changes when cso.activelyDischarging.count goes 0→1', () => {
    const h0 = computeMetroHashForTest(baseMetroInput);
    const h1 = computeMetroHashForTest({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 1 },
        advisoriesOnSelectedDate: { count: 1, windowEndsAt: null },
      },
    });
    expect(h0).not.toBe(h1);
  });

  it('hash changes when advisory count changes', () => {
    const h1 = computeMetroHashForTest({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 1 },
        advisoriesOnSelectedDate: { count: 1, windowEndsAt: null },
      },
    });
    const h2 = computeMetroHashForTest({
      ...baseMetroInput,
      cso: {
        activelyDischarging: { count: 1 },
        advisoriesOnSelectedDate: { count: 3, windowEndsAt: null },
      },
    });
    expect(h1).not.toBe(h2);
  });
});

// ─── System prompt — CSO REASONING block ─────────────────────────────────────

describe('SYSTEM_PROMPT — CSO REASONING block (metro prompt)', () => {
  it('contains the "Never surface outfall IDs" rule', () => {
    expect(SYSTEM_PROMPT).toContain('Never surface outfall IDs');
  });

  it('contains count-based guidance for the cso metro input', () => {
    expect(SYSTEM_PROMPT).toContain('NEVER name specific outfalls');
  });

  it('contains mode=forecast tense guidance', () => {
    expect(SYSTEM_PROMPT).toContain('mode=forecast');
  });

  it('contains mode=observed tense guidance', () => {
    expect(SYSTEM_PROMPT).toContain('mode=observed');
  });
});

// ─── computeMetroHashForTest — SEC-3(b) sensor quantization ───────────────────
// Sensor scalars are quantized before hashing (gageFt 0.25 ft, discharge
// 500 cfs, temps 2°F, rain 0.1 in) so refresh-cycle ticks no longer bust the
// cache. The raw values still reach the prompt — only the cache key coarsens.

describe('computeMetroHashForTest — sensor quantization (SEC-3)', () => {
  const withUpriver = (over: Record<string, number | null>): MetroSummaryInput => ({
    ...baseMetroInput,
    metroState: {
      ...(metroState as unknown as Record<string, unknown>),
      upriver: {
        ...(metroState as unknown as { upriver: Record<string, unknown> }).upriver,
        ...over,
      },
    } as unknown as MetroSummaryInput['metroState'],
  });

  it('an upriver gage tick below the 0.25 ft step does not change the hash', () => {
    expect(computeMetroHashForTest(withUpriver({ gageFt: 3.52 })))
      .toBe(computeMetroHashForTest(withUpriver({ gageFt: 3.55 })));
  });

  it('an upriver gage move across the 0.25 ft step changes the hash', () => {
    expect(computeMetroHashForTest(withUpriver({ gageFt: 3.5 })))
      .not.toBe(computeMetroHashForTest(withUpriver({ gageFt: 3.9 })));
  });

  it('a discharge tick within the 500 cfs band does not change the hash', () => {
    expect(computeMetroHashForTest(withUpriver({ dischargeCfs: 1100 })))
      .toBe(computeMetroHashForTest(withUpriver({ dischargeCfs: 1180 })));
  });

  it('air temp ticks within the 2°F band do not change the hash', () => {
    expect(computeMetroHashForTest({ ...baseMetroInput, airTempF: 82 }))
      .toBe(computeMetroHashForTest({ ...baseMetroInput, airTempF: 82.6 }));
  });

  it('rain48hIn ticks below 0.05 in do not change the hash', () => {
    expect(computeMetroHashForTest({ ...baseMetroInput, rain48hIn: 0 }))
      .toBe(computeMetroHashForTest({ ...baseMetroInput, rain48hIn: 0.04 }));
  });

  it('null sensor values hash stably', () => {
    expect(computeMetroHashForTest(withUpriver({ waterTempF: null })))
      .toBe(computeMetroHashForTest(withUpriver({ waterTempF: null })));
  });
});

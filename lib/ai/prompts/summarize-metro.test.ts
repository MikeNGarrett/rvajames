import { describe, it, expect } from 'vitest';
import { buildMetroUserMessage, type MetroSummaryInput } from './summarize-metro';
import { computeMetroHashForTest } from '@/lib/ai/get-or-generate';

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
  activeCsoOutfalls: [],
};

// ─── buildMetroUserMessage — CSO section ──────────────────────────────────────

describe('buildMetroUserMessage — CSO section', () => {
  it('emits "none" when activeCsoOutfalls is empty', () => {
    const msg = buildMetroUserMessage({ ...baseMetroInput, activeCsoOutfalls: [] });
    expect(msg).toContain('Active CSO outfalls (past 48h): none.');
  });

  it('emits "none" when activeCsoOutfalls is omitted', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeCsoOutfalls: _omit, ...withoutCso } = baseMetroInput;
    const msg = buildMetroUserMessage(withoutCso);
    expect(msg).toContain('Active CSO outfalls (past 48h): none.');
  });

  it('reports count, first outfall name, hoursAgo, and caution when outfalls are active', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      activeCsoOutfalls: [
        { name: 'CSO 34', hoursAgo: 5 },
        { name: 'CSO 12', hoursAgo: 18 },
        { name: 'CSO 07', hoursAgo: 42 },
      ],
    });
    expect(msg).toContain('Active CSO outfalls (past 48h): 3 total.');
    expect(msg).toContain('CSO 34');
    expect(msg).toContain('~5h ago');
    expect(msg).toContain('Caution for all downstream swimming access points.');
  });

  it('reports singular outfall correctly', () => {
    const msg = buildMetroUserMessage({
      ...baseMetroInput,
      activeCsoOutfalls: [{ name: 'CSO 22', hoursAgo: 12 }],
    });
    expect(msg).toContain('Active CSO outfalls (past 48h): 1 total.');
    expect(msg).toContain('CSO 22');
    expect(msg).toContain('~12h ago');
  });
});

// ─── computeMetroHashForTest — CSO hash stability ────────────────────────────

describe('computeMetroHashForTest — CSO hash stability', () => {
  it('produces identical hashes for identical inputs (stability)', () => {
    const h1 = computeMetroHashForTest(baseMetroInput);
    const h2 = computeMetroHashForTest({ ...baseMetroInput });
    expect(h1).toBe(h2);
  });

  it('hash changes when activeCsoOutfalls count goes 0→1', () => {
    const h0 = computeMetroHashForTest({ ...baseMetroInput, activeCsoOutfalls: [] });
    const h1 = computeMetroHashForTest({
      ...baseMetroInput,
      activeCsoOutfalls: [{ name: 'CSO 34', hoursAgo: 6 }],
    });
    expect(h0).not.toBe(h1);
  });

  it('hash changes when most-recent hoursAgo changes', () => {
    const h1 = computeMetroHashForTest({
      ...baseMetroInput,
      activeCsoOutfalls: [{ name: 'CSO 34', hoursAgo: 6 }],
    });
    const h2 = computeMetroHashForTest({
      ...baseMetroInput,
      activeCsoOutfalls: [{ name: 'CSO 34', hoursAgo: 12 }],
    });
    expect(h1).not.toBe(h2);
  });
});

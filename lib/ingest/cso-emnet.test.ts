/**
 * Unit tests for lib/ingest/cso-emnet.ts
 *
 * Covers all pure utility functions. The puppeteer/browser integration
 * (fetchEmnetSites) is NOT tested here — it requires a live Workers runtime
 * with the BROWSER binding. Manual smoke-test that via:
 *   pnpm dev → POST /api/cron/cso (with x-cron-secret header)
 */

import { describe, it, expect } from 'vitest';
import {
  isJamesMainstem,
  buildSourceId,
  isWithinWindow,
  buildAdvisoryHeadline,
  buildAdvisoryBody,
  joinEmnetData,
  selectAdvisoryBranch,
  analysisCoverageComplete,
} from './cso-emnet';

// ── isJamesMainstem ────────────────────────────────────────────────────────────

describe('isJamesMainstem', () => {
  it('returns true when bodies includes "James River"', () => {
    expect(isJamesMainstem(['James River', 'Gillies Creek'])).toBe(true);
  });

  it('returns true with mixed case', () => {
    expect(isJamesMainstem(['james river'])).toBe(true);
    expect(isJamesMainstem(['JAMES RIVER'])).toBe(true);
    expect(isJamesMainstem(['James River Mainstem'])).toBe(true);
  });

  it('returns true for bare "james" substring match', () => {
    // "James" alone matches the 'james' pattern
    expect(isJamesMainstem(['James'])).toBe(true);
  });

  it('returns false when bodies only contain tributaries', () => {
    expect(isJamesMainstem(['Gillies Creek'])).toBe(false);
    expect(isJamesMainstem(['Stony Run', 'Shockoe Creek'])).toBe(false);
  });

  it('returns false for empty bodies array', () => {
    expect(isJamesMainstem([])).toBe(false);
  });

  it('returns true for a mainstem site that also discharges to a tributary', () => {
    expect(isJamesMainstem(['Gillies Creek', 'James River'])).toBe(true);
  });
});

// ── buildSourceId ──────────────────────────────────────────────────────────────

describe('buildSourceId', () => {
  it('formats as "{emnetId}:{isoTimestamp}"', () => {
    const id = buildSourceId('abc-123', '2026-05-28T06:00:00.000Z');
    expect(id).toBe('abc-123:2026-05-28T06:00:00.000Z');
  });

  it('produces different ids for different occurrence timestamps at the same site', () => {
    const a = buildSourceId('abc-123', '2026-05-28T06:00:00.000Z');
    const b = buildSourceId('abc-123', '2026-05-27T06:00:00.000Z');
    expect(a).not.toBe(b);
  });

  it('produces different ids for different sites at the same timestamp', () => {
    const ts = '2026-05-28T06:00:00.000Z';
    const a = buildSourceId('site-1', ts);
    const b = buildSourceId('site-2', ts);
    expect(a).not.toBe(b);
  });

  it('is deterministic — same inputs always produce the same id', () => {
    const id1 = buildSourceId('abc-123', '2026-05-28T06:00:00.000Z');
    const id2 = buildSourceId('abc-123', '2026-05-28T06:00:00.000Z');
    expect(id1).toBe(id2);
  });
});

// ── isWithinWindow ─────────────────────────────────────────────────────────────

describe('isWithinWindow', () => {
  it('returns true for a timestamp 1 hour ago (well within 48h window)', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isWithinWindow(oneHourAgo, 48)).toBe(true);
  });

  it('returns true for a timestamp just now', () => {
    const justNow = new Date().toISOString();
    expect(isWithinWindow(justNow, 48)).toBe(true);
  });

  it('returns false for a timestamp 49 hours ago (outside 48h window)', () => {
    const tooOld = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    expect(isWithinWindow(tooOld, 48)).toBe(false);
  });

  it('returns true at the boundary (exactly 48h ago — diff equals window)', () => {
    // diff = 48 * 3600 * 1000, condition is <= so this is true
    const exactly48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(isWithinWindow(exactly48h, 48)).toBe(true);
  });

  it('returns false for an invalid / unparseable timestamp', () => {
    expect(isWithinWindow('not-a-date', 48)).toBe(false);
    expect(isWithinWindow('', 48)).toBe(false);
  });

  it('respects a custom windowHours parameter', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(isWithinWindow(twoHoursAgo, 1)).toBe(false);  // outside 1h window
    expect(isWithinWindow(twoHoursAgo, 3)).toBe(true);   // inside 3h window
  });
});

// ── buildAdvisoryHeadline ─────────────────────────────────────────────────────

describe('buildAdvisoryHeadline', () => {
  it('includes the outfall name', () => {
    const h = buildAdvisoryHeadline('Manchester CSO outfall 005');
    expect(h).toContain('Manchester CSO outfall 005');
  });

  it('includes "CSO" in the text', () => {
    const h = buildAdvisoryHeadline('Test Outfall');
    expect(h).toMatch(/CSO/i);
  });

  it('includes "discharge" to clearly communicate the event type', () => {
    const h = buildAdvisoryHeadline('Test Outfall');
    expect(h).toMatch(/discharge/i);
  });
});

// ── buildAdvisoryBody ─────────────────────────────────────────────────────────

describe('buildAdvisoryBody', () => {
  const outfallName = 'Manchester CSO outfall 005';
  const occurrence  = '2026-05-28T10:00:00.000Z';

  it('includes the outfall name', () => {
    expect(buildAdvisoryBody(outfallName, occurrence)).toContain(outfallName);
  });

  it('mentions bacterial indicators', () => {
    const body = buildAdvisoryBody(outfallName, occurrence);
    expect(body).toMatch(/E\. coli|Enterococci|bacterial/i);
  });

  it('mentions the 72-hour window', () => {
    const body = buildAdvisoryBody(outfallName, occurrence);
    expect(body).toMatch(/72 hour/i);
  });

  it('includes a formatted timestamp from the occurrence', () => {
    // 2026-05-28T10:00:00.000Z → "May 28" in ET (UTC-4 in May = 6am ET)
    const body = buildAdvisoryBody(outfallName, occurrence);
    expect(body).toMatch(/May 28/);
  });

  it('mentions "downstream" to communicate directionality', () => {
    const body = buildAdvisoryBody(outfallName, occurrence);
    expect(body).toMatch(/downstream/i);
  });
});

// ── joinEmnetData — overflow field (sub-goal 93) ──────────────────────────────

describe('joinEmnetData — overflow field', () => {
  // Minimal fixtures: one visualization site, one matching inode, one analysis result.
  const vSite = {
    name: 'CSO 34',
    site_type: 'CSO',
    bodies: '',          // triggers James River default
    analysis_config_id: 42,
  };
  const inode = {
    id: 1,
    name: 'sensor-1',
    description: 'CSO 34',
    lat: 37.54,
    lon: -77.44,
  };

  it('sets overflow=true when cso_active_overflow is true', () => {
    const analysisResults = new Map([
      [42, {
        analysis_configuration_id: 42,
        analysis_results: {
          analysis_results: {
            cso_last_occurrence: '2026-05-30T10:00:00',
            cso_active_overflow: true,
          },
        },
      }],
    ]);
    const sites = joinEmnetData([vSite], [inode], analysisResults);
    expect(sites).toHaveLength(1);
    expect(sites[0].overflow).toBe(true);
  });

  it('sets overflow=false when cso_active_overflow is false', () => {
    const analysisResults = new Map([
      [42, {
        analysis_configuration_id: 42,
        analysis_results: {
          analysis_results: {
            cso_last_occurrence: '2026-05-30T10:00:00',
            cso_active_overflow: false,
          },
        },
      }],
    ]);
    const sites = joinEmnetData([vSite], [inode], analysisResults);
    expect(sites).toHaveLength(1);
    expect(sites[0].overflow).toBe(false);
  });

  it('sets overflow=null when cso_active_overflow is absent', () => {
    const analysisResults = new Map([
      [42, {
        analysis_configuration_id: 42,
        analysis_results: {
          analysis_results: {
            cso_last_occurrence: '2026-05-30T10:00:00',
            // cso_active_overflow omitted
          },
        },
      }],
    ]);
    const sites = joinEmnetData([vSite], [inode], analysisResults);
    expect(sites).toHaveLength(1);
    expect(sites[0].overflow).toBeNull();
  });

  it('sets overflow=null when no analysis result is available for the site', () => {
    const sites = joinEmnetData([vSite], [inode], new Map());
    expect(sites).toHaveLength(1);
    expect(sites[0].overflow).toBeNull();
  });
});

// ── selectAdvisoryBranch (sub-goal 94) ────────────────────────────────────────

describe('selectAdvisoryBranch', () => {
  const WINDOW = 48;
  const recentOccurrence = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const staleOccurrence  = new Date(Date.now() - 50 * 3_600_000).toISOString();

  it('returns "skip" when site does not affect James mainstem', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: false, overflow: true, csoLastOccurrence: recentOccurrence },
      WINDOW,
    );
    expect(branch).toBe('skip');
  });

  it('returns "active-overflow" when overflow=true and affects mainstem', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: true, csoLastOccurrence: recentOccurrence },
      WINDOW,
    );
    expect(branch).toBe('active-overflow');
  });

  it('returns "active-overflow" even when csoLastOccurrence is stale (overflow flag wins)', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: true, csoLastOccurrence: staleOccurrence },
      WINDOW,
    );
    expect(branch).toBe('active-overflow');
  });

  it('returns "active-overflow" even when csoLastOccurrence is null and overflow=true', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: true, csoLastOccurrence: null },
      WINDOW,
    );
    expect(branch).toBe('active-overflow');
  });

  it('returns "inactive-window" when overflow=false and csoLastOccurrence is within the window', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: false, csoLastOccurrence: recentOccurrence },
      WINDOW,
    );
    expect(branch).toBe('inactive-window');
  });

  it('returns "skip" when overflow=false and csoLastOccurrence is outside the window', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: false, csoLastOccurrence: staleOccurrence },
      WINDOW,
    );
    expect(branch).toBe('skip');
  });

  it('returns "skip" when overflow=false and csoLastOccurrence is null', () => {
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: false, csoLastOccurrence: null },
      WINDOW,
    );
    expect(branch).toBe('skip');
  });

  it('returns "inactive-window" when overflow=null but a recent occurrence is within the window', () => {
    // overflow=null = EmNet reported no live current-state flag. A confirmed
    // recent occurrence is still evidence of a real discharge, so surface it.
    // (prod 2026-06-23: CSO 11/15/20 near Belle Isle had exactly this shape —
    // null overflow + recent event — and were wrongly skipped.)
    const branch = selectAdvisoryBranch(
      { affectsJamesMainstem: true, overflow: null, csoLastOccurrence: recentOccurrence },
      WINDOW,
    );
    expect(branch).toBe('inactive-window');
  });

  it('returns "skip" when overflow=null and there is no recent occurrence in the window', () => {
    expect(
      selectAdvisoryBranch(
        { affectsJamesMainstem: true, overflow: null, csoLastOccurrence: null },
        WINDOW,
      ),
    ).toBe('skip');
    expect(
      selectAdvisoryBranch(
        { affectsJamesMainstem: true, overflow: null, csoLastOccurrence: staleOccurrence },
        WINDOW,
      ),
    ).toBe('skip');
  });

  it('respects a custom windowHours — recent occurrence outside a narrow window → skip', () => {
    // 2h ago is within 48h but NOT within 1h
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(
      selectAdvisoryBranch(
        { affectsJamesMainstem: true, overflow: false, csoLastOccurrence: twoHoursAgo },
        1,
      ),
    ).toBe('skip');
  });
});

// ── analysisCoverageComplete (poll-until-complete gate) ───────────────────────

describe('analysisCoverageComplete', () => {
  const vSite = (name: string, configId: number) => ({
    name,
    site_type: 'CSO',
    bodies: '',
    analysis_config_id: configId,
  });
  const goodInode = (name: string) => ({
    id: 1, name: 'sensor', description: name, lat: 37.54, lon: -77.44,
  });
  const sentinelInode = (name: string) => ({
    id: 2, name: 'sensor', description: name, lat: -999, lon: -999,
  });
  const result = (configId: number) => ({
    analysis_configuration_id: configId,
    analysis_results: { analysis_results: { cso_last_occurrence: null, cso_active_overflow: false } },
  });

  it('returns false while still loading (no viz sites yet)', () => {
    expect(analysisCoverageComplete([], [], new Map())).toBe(false);
  });

  it('returns false when a valid-coord site is missing its analysis-results', () => {
    const viz = [vSite('CSO 20', 10), vSite('CSO 21', 11)];
    const inodes = [goodInode('CSO 20'), goodInode('CSO 21')];
    const results = new Map([[10, result(10)]]); // CSO 21 (config 11) not captured yet
    expect(analysisCoverageComplete(viz, inodes, results)).toBe(false);
  });

  it('returns true when all valid-coord sites have analysis-results', () => {
    const viz = [vSite('CSO 20', 10), vSite('CSO 21', 11)];
    const inodes = [goodInode('CSO 20'), goodInode('CSO 21')];
    const results = new Map([[10, result(10)], [11, result(11)]]);
    expect(analysisCoverageComplete(viz, inodes, results)).toBe(true);
  });

  it('does NOT wait on sentinel-coord sites (e.g. CSO 6/16) that the join drops', () => {
    // CSO 6 has -999 coords and never reports analysis-results; coverage is
    // still complete once the only valid-coord site (CSO 20) is captured.
    const viz = [vSite('CSO 20', 10), vSite('CSO 6', 99)];
    const inodes = [goodInode('CSO 20'), sentinelInode('CSO 6')];
    const results = new Map([[10, result(10)]]);
    expect(analysisCoverageComplete(viz, inodes, results)).toBe(true);
  });
});

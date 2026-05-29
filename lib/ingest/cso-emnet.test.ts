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

  it('mentions the 48-hour window', () => {
    const body = buildAdvisoryBody(outfallName, occurrence);
    expect(body).toMatch(/48 hour/i);
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

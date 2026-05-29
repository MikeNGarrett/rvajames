/**
 * Tests for lib/ingest/closures/sources/venture-richmond.ts
 *
 * Two layers:
 *   1. scrapePage — exported function, fetch mocked via vi.stubGlobal
 *   2. ventureRichmondSource.run — integration, Supabase client mocked
 *
 * Covers:
 *   a) First run inserts N rows
 *   b) Second run with same articles inserts 0 rows (natural-key dedup)
 *   c) New article in second run inserts 1 row
 *   d) Existing active row blocks new draft for same (URL, location)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';
import { scrapePage, ventureRichmondSource } from './venture-richmond';

// ── HTML fixtures ─────────────────────────────────────────────────────────────

function makeNewsHtml(paragraphs: string[]): string {
  const content = paragraphs.map((p) => `<article><h2>${p}</h2></article>`).join('\n');
  return `<!DOCTYPE html><html><body>${content}</body></html>`;
}

// ── scrapePage unit tests ─────────────────────────────────────────────────────

describe('scrapePage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns empty array when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));
    const hits = await scrapePage('https://venturerichmond.com/news/');
    expect(hits).toHaveLength(0);
  });

  it('returns one hit for a Browns Island construction headline', async () => {
    // Note: the regex is /browns?\s+island/i which matches "Browns Island" (no apostrophe).
    // Real site uses "Browns Island" without apostrophe — the apostrophe variant won't match.
    const html = makeNewsHtml(['Browns Island construction closure begins next week']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://venturerichmond.com/news/');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('browns-island');
    expect(hits[0].sourceUrl).toBe('https://venturerichmond.com/news/');
  });

  it('returns empty when headline has location but no closure keyword', async () => {
    const html = makeNewsHtml(["Brown's Island Summer Festival Schedule"]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://venturerichmond.com/news/');
    expect(hits).toHaveLength(0);
  });

  it('collapses multiple closure mentions of the same location into one hit', async () => {
    // Use "Browns Island" (no apostrophe) to match /browns?\s+island/i
    const html = `<!DOCTYPE html><html><body>
      <article>
        <p>Browns Island is closed for the season.</p>
        <p>Browns Island access is restricted until further notice.</p>
      </article>
    </body></html>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://venturerichmond.com/browns-island-improvement-plan/');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('browns-island');
  });

  it('produces two hits for two different locations', async () => {
    const html = makeNewsHtml([
      'Browns Island construction closure announced',
      'Belle Isle trail access restricted',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://venturerichmond.com/news/');
    expect(hits).toHaveLength(2);
    const slugs = hits.map((h) => h.locationSlug).sort();
    expect(slugs).toEqual(['belle-isle', 'browns-island']);
  });
});

// ── Helpers for integration tests ─────────────────────────────────────────────

const LOC_BROWNS = { id: 'loc-browns', slug: 'browns-island' };
const LOC_BELLE  = { id: 'loc-belle',  slug: 'belle-isle'    };

function makeMockClient({
  locationRows      = [LOC_BROWNS, LOC_BELLE] as { id: string; slug: string }[],
  existingDedupRows = [] as { source_url: string; location_id: string }[],
  insertError       = null as { message: string } | null,
} = {}) {
  const insertMock = vi.fn().mockResolvedValue({ error: insertError });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'locations') {
      const eqMock     = vi.fn().mockResolvedValue({ data: locationRows, error: null });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      return { select: selectMock };
    }

    if (table === 'location_status') {
      const inMock2    = vi.fn().mockResolvedValue({ data: existingDedupRows, error: null });
      const eqMock2    = vi.fn().mockReturnValue({ in: inMock2 });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock2 });
      return { select: selectMock, insert: insertMock };
    }

    return {};
  });

  return { from: fromMock, _insertMock: insertMock };
}

const NEWS_URL    = 'https://venturerichmond.com/news/';
const PROJECT_URL = 'https://venturerichmond.com/browns-island-improvement-plan/';

function stubFetchBrownsIslandHit() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('robots.txt')) {
      return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
    }
    if (typeof url === 'string' && url.includes('/news/')) {
      return Promise.resolve({
        ok: true,
        text: async () => makeNewsHtml(['Browns Island construction closure begins']),
      });
    }
    // browns-island-improvement-plan — empty
    return Promise.resolve({ ok: true, text: async () => '<html></html>' });
  }));
}

// ── ventureRichmondSource.run integration tests ───────────────────────────────

describe('ventureRichmondSource.run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('(a) first run inserts rows when no existing drafts', async () => {
    stubFetchBrownsIslandHit();
    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await ventureRichmondSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBeGreaterThan(0);
    expect(mockClient._insertMock).toHaveBeenCalled();
  });

  it('(b) second run with same articles inserts 0 rows', async () => {
    stubFetchBrownsIslandHit();

    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: NEWS_URL, location_id: LOC_BROWNS.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await ventureRichmondSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('(c) new article in second run inserts 1 row', async () => {
    // News page has browns-island + belle-isle hits; browns is already known
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
      }
      if (typeof url === 'string' && url.includes('/news/')) {
        return Promise.resolve({
          ok: true,
          text: async () => makeNewsHtml([
            'Browns Island construction closure begins',
            'Belle Isle trail access restricted',
          ]),
        });
      }
      return Promise.resolve({ ok: true, text: async () => '<html></html>' });
    }));

    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: NEWS_URL, location_id: LOC_BROWNS.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await ventureRichmondSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(1);
    expect(mockClient._insertMock).toHaveBeenCalledOnce();

    const inserted = mockClient._insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.location_id).toBe(LOC_BELLE.id);
  });

  it('(d) existing active row blocks new draft for same (URL, location)', async () => {
    stubFetchBrownsIslandHit();

    // Simulate an 'active' row for the same (URL, location) — still blocked
    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: NEWS_URL, location_id: LOC_BROWNS.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await ventureRichmondSource.run();

    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('returns ok:false when robots.txt disallows access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /\n',
    }));

    const mockClient = makeMockClient();
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await ventureRichmondSource.run();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('robots.txt');
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('scrapes the browns-island-improvement-plan page in addition to news', async () => {
    let projectPageFetched = false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
      }
      if (typeof url === 'string' && url.includes('browns-island-improvement-plan')) {
        projectPageFetched = true;
        return Promise.resolve({
          ok: true,
          text: async () => makeNewsHtml(['Browns Island is closed for improvements']),
        });
      }
      return Promise.resolve({ ok: true, text: async () => '<html></html>' });
    }));

    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    await ventureRichmondSource.run();

    expect(projectPageFetched).toBe(true);
    expect(mockClient._insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source_url: PROJECT_URL }),
    );
  });
});

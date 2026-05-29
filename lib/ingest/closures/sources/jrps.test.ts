/**
 * Tests for lib/ingest/closures/sources/jrps.ts
 *
 * Two layers:
 *   1. scrapePage — exported pure(-ish) function, fetch mocked via vi.stubGlobal
 *   2. jrpsSource.run — integration, Supabase client mocked
 *
 * Covers:
 *   a) First run inserts N rows
 *   b) Second run with same articles inserts 0 rows (natural-key dedup)
 *   c) New article in second run inserts 1 row
 *   d) Existing active row blocks new draft for same (URL, location)
 *   e) An article with 3 matching paragraphs for the same location creates 1 row
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';
import { scrapePage, jrpsSource } from './jrps';

// ── HTML fixtures ─────────────────────────────────────────────────────────────

/**
 * Build a simple WordPress-style page HTML with JSON-LD and body paragraphs.
 * paragraphs is an array of text strings; each becomes an <article><p> element.
 */
function makeArticleHtml(opts: {
  headline?: string;
  datePublished?: string;
  paragraphs?: string[];
  h1?: string;
}): string {
  const { headline, datePublished, paragraphs = [], h1 = 'Article Title' } = opts;

  const jsonLd = headline
    ? `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Article',
        headline,
        datePublished: datePublished ?? '2026-05-01T00:00:00Z',
      })}</script>`
    : '';

  const paragraphHtml = paragraphs.map((p) => `<p>${p}</p>`).join('\n');

  return `<!DOCTYPE html><html><head>${jsonLd}</head><body>
    <h1>${h1}</h1>
    <article>
      ${paragraphHtml}
    </article>
  </body></html>`;
}

// ── scrapePage unit tests ─────────────────────────────────────────────────────

describe('scrapePage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns empty array when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));
    const hits = await scrapePage('https://jamesriverpark.org/news/');
    expect(hits).toHaveLength(0);
  });

  it('returns one hit per location when one paragraph mentions pipeline-trail', async () => {
    const html = makeArticleHtml({
      headline: 'Pipeline Trail Closure Update',
      datePublished: '2026-05-01T00:00:00Z',
      paragraphs: ['The Pipeline Trail is closed for maintenance due to construction work.'],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://jamesriverpark.org/2026/05/01/pipeline/');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('pipeline-trail');
    // reason should be the JSON-LD headline, not the paragraph
    expect(hits[0].reason).toBe('Pipeline Trail Closure Update');
    expect(hits[0].datePublished).toBe('2026-05-01T00:00:00Z');
  });

  it('(e) collapses 3 matching paragraphs for the same location into 1 hit', async () => {
    const html = makeArticleHtml({
      headline: 'Pipeline Trail Closure',
      paragraphs: [
        'The Pipeline Trail is currently closed.',
        'Pipeline Trail access is restricted near the pump station.',
        'Please avoid the Pipeline Trail until further notice.',
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://jamesriverpark.org/2026/05/01/pipeline/');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('pipeline-trail');
    expect(hits[0].reason).toBe('Pipeline Trail Closure');
  });

  it('produces two hits when an article mentions both pipeline-trail and belle-isle', async () => {
    const html = makeArticleHtml({
      headline: 'Park Closures',
      paragraphs: [
        'The Pipeline Trail is closed for construction.',
        'Belle Isle access is also restricted this week.',
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://jamesriverpark.org/2026/05/01/park-closures/');
    expect(hits).toHaveLength(2);
    const slugs = hits.map((h) => h.locationSlug).sort();
    expect(slugs).toEqual(['belle-isle', 'pipeline-trail']);
    // Both hits use the same JSON-LD headline
    expect(hits.every((h) => h.reason === 'Park Closures')).toBe(true);
  });

  it('falls back to paragraph text when no JSON-LD headline present', async () => {
    const html = makeArticleHtml({
      paragraphs: ['The Pipeline Trail is closed for construction.'],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://jamesriverpark.org/2026/05/01/pipeline/');
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe('The Pipeline Trail is closed for construction.');
  });

  it('uses h1 fallback for pipeline URL with no keyword paragraphs', async () => {
    const html = `<!DOCTYPE html><html><body>
      <h1>What's Going On With the Pipeline Trail</h1>
      <article><p>Some general content without closure keywords that match.</p></article>
    </body></html>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://jamesriverpark.org/whats-going-on-with-pipeline/');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('pipeline-trail');
  });
});

// ── Helpers for integration tests ─────────────────────────────────────────────

const LOC_PIPELINE = { id: 'loc-pipeline', slug: 'pipeline-trail' };
const LOC_BELLE    = { id: 'loc-belle',    slug: 'belle-isle'     };

/**
 * Build a Supabase mock for jrpsSource.run.
 *
 * Query chains used by runJrpsSource:
 *   1. locations: .select('id,slug').eq('kind','access_point') → data
 *   2. location_status (dedup): .select('source_url,location_id').eq('source',…).in('state',…) → data
 *   3. location_status (insert): .insert(row) → { error }
 */
function makeMockClient({
  locationRows      = [LOC_PIPELINE, LOC_BELLE] as { id: string; slug: string }[],
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
      // Dedup query chain: .select(…).eq('source', …).in('state', …)
      const inMock2   = vi.fn().mockResolvedValue({ data: existingDedupRows, error: null });
      const eqMock2   = vi.fn().mockReturnValue({ in: inMock2 });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock2 });
      return { select: selectMock, insert: insertMock };
    }

    return {};
  });

  return { from: fromMock, _insertMock: insertMock };
}

// ── jrpsSource.run integration tests ─────────────────────────────────────────

// News index URL — the first SCRAPE_PAGE that produces hits in stubs below
const NEWS_URL = 'https://jamesriverpark.org/news/';

/** Stub fetch: robots.txt allowed + one article with one pipeline-trail hit */
function stubFetchSingleArticle() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('robots.txt')) {
      return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
    }
    // News index — one article link (we don't follow links, just scrape text)
    if (typeof url === 'string' && url.includes('/news/')) {
      const html = makeArticleHtml({
        headline: 'Pipeline Trail Closure',
        paragraphs: ['The Pipeline Trail is closed for construction.'],
      });
      return Promise.resolve({ ok: true, text: async () => html });
    }
    // Pipeline trail specific page — empty
    if (typeof url === 'string' && url.includes('pipeline')) {
      const html = makeArticleHtml({ paragraphs: [] });
      return Promise.resolve({ ok: true, text: async () => html });
    }
    return Promise.resolve({ ok: true, text: async () => '<html></html>' });
  }));
}

describe('jrpsSource.run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('(a) first run inserts rows when no existing drafts', async () => {
    stubFetchSingleArticle();
    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await jrpsSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBeGreaterThan(0);
    expect(mockClient._insertMock).toHaveBeenCalled();
  });

  it('(b) second run with same articles inserts 0 rows', async () => {
    stubFetchSingleArticle();

    // Simulate: dedup rows already exist for pipeline-trail on the news URL
    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: NEWS_URL, location_id: LOC_PIPELINE.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await jrpsSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('(c) new article in second run inserts 1 row', async () => {
    // Fetch: news page has pipeline + belle-isle, but dedup already has pipeline
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
      }
      if (typeof url === 'string' && url.includes('/news/')) {
        const html = makeArticleHtml({
          headline: 'Park Updates',
          paragraphs: [
            'The Pipeline Trail is closed for construction.',
            'Belle Isle is also temporarily closed.',
          ],
        });
        return Promise.resolve({ ok: true, text: async () => html });
      }
      return Promise.resolve({ ok: true, text: async () => '<html></html>' });
    }));

    // pipeline-trail already known, belle-isle is new
    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: NEWS_URL, location_id: LOC_PIPELINE.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await jrpsSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(1);
    expect(mockClient._insertMock).toHaveBeenCalledOnce();

    const inserted = mockClient._insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.location_id).toBe(LOC_BELLE.id);
  });

  it('(d) existing active row blocks new draft for same (URL, location)', async () => {
    stubFetchSingleArticle();

    // Simulate an active (not draft) row already existing
    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: NEWS_URL, location_id: LOC_PIPELINE.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await jrpsSource.run();

    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('(e) article with 3 matching paragraphs for same location creates 1 row', async () => {
    // Verified at the scrapePage level above; confirm the run integration too.
    // The stub returns 3-paragraph pipeline content only for the /news/ page;
    // the /whats-going-on-with-pipeline/ page returns empty so dedup doesn't
    // see the same location from a second URL in the same run.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
      }
      if (typeof url === 'string' && url.includes('/news/')) {
        const html = makeArticleHtml({
          headline: 'Pipeline Trail Closure',
          paragraphs: [
            'The Pipeline Trail is currently closed.',
            'Pipeline Trail access is restricted near the pump station.',
            'Please avoid the Pipeline Trail until further notice.',
          ],
        });
        return Promise.resolve({ ok: true, text: async () => html });
      }
      // whats-going-on-with-pipeline — no closure keywords, won't produce hits
      // (The h1 fallback only fires when slugToFirstParagraph.size === 0 AND
      //  matchesLocationKeyword(h1) returns a slug. Use an h1 with no location keyword.)
      return Promise.resolve({ ok: true, text: async () => '<html><body><h1>Updates</h1><p>General info.</p></body></html>' });
    }));

    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await jrpsSource.run();

    // Only the /news/ page produces content (pipeline page stub returns no location match).
    // 3 paragraphs all for pipeline-trail → collapsed to 1 hit → 1 insert.
    expect(result.rowsWritten).toBe(1);
    expect(mockClient._insertMock).toHaveBeenCalledOnce();
  });

  it('returns ok:false when robots.txt disallows access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /\n',
    }));

    const mockClient = makeMockClient();
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await jrpsSource.run();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('robots.txt');
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('returns ok:false when location lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: async () => 'User-agent: *\nDisallow:\n' });
      }
      return Promise.resolve({ ok: true, text: async () => '<html></html>' });
    }));

    const fromMock = vi.fn().mockImplementation(() => {
      const eqMock     = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      return { select: selectMock };
    });

    vi.mocked(createServerClient).mockResolvedValue({ from: fromMock } as never);

    const result = await jrpsSource.run();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('DB error');
  });
});

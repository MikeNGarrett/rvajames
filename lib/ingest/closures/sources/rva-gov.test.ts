/**
 * Tests for lib/ingest/closures/sources/rva-gov.ts
 *
 * Two layers:
 *   1. scrapePage — exported function, fetch mocked via vi.stubGlobal
 *   2. rvaGovSource.run — integration, Supabase client mocked
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
import { scrapePage, rvaGovSource } from './rva-gov';

// ── HTML fixtures ─────────────────────────────────────────────────────────────

function makeDrupalHtml(paragraphs: string[]): string {
  const content = paragraphs
    .map((p) => `<div class="field--name-body"><p>${p}</p></div>`)
    .join('\n');
  return `<!DOCTYPE html><html><body>${content}</body></html>`;
}

// ── scrapePage unit tests ─────────────────────────────────────────────────────

describe('scrapePage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns empty array when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => '' }));
    const hits = await scrapePage('https://www.rva.gov/parks-recreation/james-river-park-system');
    expect(hits).toHaveLength(0);
  });

  it('returns one hit for a Pipeline Trail closed notice', async () => {
    const html = makeDrupalHtml(['Notice: Pipeline Trail is closed for utility work.']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://www.rva.gov/parks-recreation/james-river-park-system');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('pipeline-trail');
  });

  it('returns a park-wide hit (locationSlug null) when no location keyword found', async () => {
    const html = makeDrupalHtml(['Notice: Park facilities are closed due to flooding.']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://www.rva.gov/parks-recreation/james-river-park-system');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBeNull();
  });

  it('returns empty when paragraph has no closure keyword', async () => {
    const html = makeDrupalHtml(['Pipeline Trail events are scheduled for the weekend.']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://www.rva.gov/parks-recreation/james-river-park-system');
    expect(hits).toHaveLength(0);
  });

  it('collapses multiple closure paragraphs for the same location into one hit', async () => {
    const html = makeDrupalHtml([
      'Pipeline Trail is closed for construction.',
      'Pipeline Trail remains inaccessible until further notice.',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://www.rva.gov/parks-recreation/james-river-park-system');
    expect(hits).toHaveLength(1);
    expect(hits[0].locationSlug).toBe('pipeline-trail');
  });

  it('produces two hits for two different locations', async () => {
    const html = makeDrupalHtml([
      'Pipeline Trail is closed for construction.',
      'Belle Isle access is restricted due to flooding.',
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }));

    const hits = await scrapePage('https://www.rva.gov/parks-recreation/james-river-park-system');
    expect(hits).toHaveLength(2);
    const slugs = hits.map((h) => h.locationSlug).sort();
    expect(slugs).toEqual(['belle-isle', 'pipeline-trail']);
  });
});

// ── Helpers for integration tests ─────────────────────────────────────────────

const LOC_PIPELINE = { id: 'loc-pipeline', slug: 'pipeline-trail' };
const LOC_BELLE    = { id: 'loc-belle',    slug: 'belle-isle'     };

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
      const inMock2    = vi.fn().mockResolvedValue({ data: existingDedupRows, error: null });
      const eqMock2    = vi.fn().mockReturnValue({ in: inMock2 });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock2 });
      return { select: selectMock, insert: insertMock };
    }

    return {};
  });

  return { from: fromMock, _insertMock: insertMock };
}

const PARKS_URL = 'https://www.rva.gov/parks-recreation/james-river-park-system';
const DPU_URL   = 'https://www.rva.gov/press-releases-and-announcements-public-utilities/news';

function stubFetchPipelineHit() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url === PARKS_URL) {
      return Promise.resolve({
        ok: true,
        text: async () => makeDrupalHtml(['Pipeline Trail is closed for construction.']),
      });
    }
    // DPU page — empty
    return Promise.resolve({ ok: true, text: async () => '<html></html>' });
  }));
}

// ── rvaGovSource.run integration tests ───────────────────────────────────────

describe('rvaGovSource.run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('(a) first run inserts rows when no existing drafts', async () => {
    stubFetchPipelineHit();
    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await rvaGovSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBeGreaterThan(0);
    expect(mockClient._insertMock).toHaveBeenCalled();

    const inserted = mockClient._insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.source_url).toBe(PARKS_URL);
    expect(inserted.location_id).toBe(LOC_PIPELINE.id);
  });

  it('(b) second run with same articles inserts 0 rows', async () => {
    stubFetchPipelineHit();

    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: PARKS_URL, location_id: LOC_PIPELINE.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await rvaGovSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('(c) new article in second run inserts 1 row', async () => {
    // Parks page has pipeline + belle-isle; pipeline already known
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url === PARKS_URL) {
        return Promise.resolve({
          ok: true,
          text: async () => makeDrupalHtml([
            'Pipeline Trail is closed for construction.',
            'Belle Isle access is restricted.',
          ]),
        });
      }
      return Promise.resolve({ ok: true, text: async () => '<html></html>' });
    }));

    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: PARKS_URL, location_id: LOC_PIPELINE.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await rvaGovSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(1);
    expect(mockClient._insertMock).toHaveBeenCalledOnce();

    const inserted = mockClient._insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.location_id).toBe(LOC_BELLE.id);
  });

  it('(d) existing active row blocks new draft for same (URL, location)', async () => {
    stubFetchPipelineHit();

    // An 'active' row (state='active') is still included in the dedup query
    const mockClient = makeMockClient({
      existingDedupRows: [
        { source_url: PARKS_URL, location_id: LOC_PIPELINE.id },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await rvaGovSource.run();

    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });

  it('scrapes the DPU press-release page in addition to parks page', async () => {
    let dpuPageFetched = false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url === DPU_URL) {
        dpuPageFetched = true;
        return Promise.resolve({
          ok: true,
          text: async () => makeDrupalHtml(['Notice: Pipeline Trail closed for utility work.']),
        });
      }
      return Promise.resolve({ ok: true, text: async () => '<html></html>' });
    }));

    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    await rvaGovSource.run();

    expect(dpuPageFetched).toBe(true);
  });

  it('returns ok:false when location lookup fails', async () => {
    stubFetchPipelineHit();

    const fromMock = vi.fn().mockImplementation(() => {
      const eqMock     = vi.fn().mockResolvedValue({ data: null, error: { message: 'connection error' } });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      return { select: selectMock };
    });

    vi.mocked(createServerClient).mockResolvedValue({ from: fromMock } as never);

    const result = await rvaGovSource.run();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('connection error');
  });

  it('returns ok:true with 0 rows when no closure paragraphs found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body><div class="field--name-body"><p>Park hours: 6am–10pm daily.</p></div></body></html>',
    }));

    const mockClient = makeMockClient({ existingDedupRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await rvaGovSource.run();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
    expect(mockClient._insertMock).not.toHaveBeenCalled();
  });
});

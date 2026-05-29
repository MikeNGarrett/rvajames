/**
 * Friends of James River Park System (jamesriverpark.org) closure source.
 *
 * News index: https://jamesriverpark.org/news/ (primary candidate)
 * Article URL pattern: /YYYY/MM/DD/slug/
 * JSON-LD: datePublished + headline present on individual articles
 *
 * robots.txt is checked at scrape time. If the path is disallowed, the
 * source returns { ok: false, rowsWritten: 0, error: 'robots.txt disallows access' }
 * so other closure sources continue unaffected.
 *
 * Polite scraping:
 *   User-Agent: rva-james-bot (mike.garrett@teamcolab.com)
 *   ≥ 1 s delay between page fetches
 *   No parallel fetches
 *
 * Draft rows only — never auto-approved. Admin reviews at /admin/closures.
 *
 * Investigation note: jamesriverpark.org's primary news archive is at /news/.
 * Article pages follow the WordPress /YYYY/MM/DD/slug/ URL pattern and include
 * JSON-LD Article schema with datePublished + headline. The site also has a
 * dedicated Pipeline Trail post at /whats-going-on-with-pipeline/ which is
 * included as a high-value one-off scrape target.
 *
 * Dedup (2026-05-28 refactor): natural key = `${source_url}::${location_id}`.
 * One draft per (article URL, location). Multi-paragraph matches for the same
 * (article, location) are collapsed into a single hit — reason prefers the
 * JSON-LD headline over an excerpt paragraph.
 */

import * as cheerio from 'cheerio/slim';
import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from '@/lib/ingest/run';
import type { ClosureSource } from '@/lib/ingest/closures/registry';
import { naturalKey, loadExistingKeys } from '@/lib/ingest/closures/dedup';

const SOURCE_NAME = 'Friends of James River Park';
const BOT_UA = 'rva-james-bot (mike.garrett@teamcolab.com)';
const BASE_URL = 'https://jamesriverpark.org';
const ROBOTS_URL = `${BASE_URL}/robots.txt`;

const SCRAPE_PAGES = [
  { url: `${BASE_URL}/news/`,                          label: 'JRPS News index' },
  { url: `${BASE_URL}/whats-going-on-with-pipeline/`,  label: 'Pipeline Trail update' },
];

/** Our 10 location slugs */
const LOCATION_KEYWORDS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /pipeline\s+trail/i,   slug: 'pipeline-trail'   },
  { pattern: /pony\s+pasture/i,     slug: 'pony-pasture'     },
  { pattern: /texas\s+beach/i,      slug: 'texas-beach'      },
  { pattern: /belle\s+isle/i,       slug: 'belle-isle'       },
  { pattern: /browns?\s+island/i,   slug: 'browns-island'    },
  { pattern: /mayo\s+island/i,      slug: 'mayo-island'      },
  { pattern: /shiplock/i,           slug: 'shiplock-trail'   },
  { pattern: /north\s+bank/i,       slug: 'north-bank-trail' },
  { pattern: /buttermilk/i,         slug: 'buttermilk-trail' },
  { pattern: /pump\s+house/i,       slug: 'pump-house'       },
  { pattern: /reedy\s+creek/i,      slug: 'reedy-creek'      },
  { pattern: /tredegar/i,           slug: 'tredegar'         },
  { pattern: /james\s+river\s+park/i, slug: 'belle-isle'     }, // park-wide; fall back to belle-isle
];

const CLOSURE_KEYWORDS = [
  /\bclosed\b/i,
  /\bclosure\b/i,
  /\bconstruction\b/i,
  /\baccess\b/i,
  /\breopen/i,
  /\binaccessible\b/i,
  /\bwhat.s\s+going\s+on\b/i, // matches "What's Going On With Pipeline"
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function matchesLocationKeyword(text: string): string | null {
  for (const { pattern, slug } of LOCATION_KEYWORDS) {
    if (pattern.test(text)) return slug;
  }
  return null;
}

function hasClosureKeyword(text: string): boolean {
  return CLOSURE_KEYWORDS.some((re) => re.test(text));
}

/**
 * Parse robots.txt and return whether the given paths are allowed for our bot.
 */
async function isAllowedByRobots(robotsUrl: string, targetPaths: string[]): Promise<boolean> {
  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': BOT_UA },
    });
    if (!res.ok) return true;

    const text = await res.text();
    const lines = text.split('\n').map((l) => l.trim());

    let inOurBlock = false;
    const disallowedPaths: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.slice('user-agent:'.length).trim().toLowerCase();
        inOurBlock = agent === '*' || agent === 'rva-james-bot';
        if (!inOurBlock) disallowedPaths.length = 0;
      } else if (inOurBlock && line.toLowerCase().startsWith('disallow:')) {
        const path = line.slice('disallow:'.length).trim();
        if (path) disallowedPaths.push(path);
      }
    }

    for (const targetPath of targetPaths) {
      for (const disallowed of disallowedPaths) {
        if (targetPath.startsWith(disallowed)) {
          console.warn(`[jrps] robots.txt disallows ${targetPath} (rule: ${disallowed})`);
          return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * One hit per (article URL, location slug). Reason is the JSON-LD headline
 * if available; otherwise the first matching paragraph for that location.
 * Multiple paragraphs from the same article mentioning the same location are
 * collapsed into this single record.
 */
export interface ScrapeHit {
  locationSlug: string;
  reason: string;       // headline > first matching paragraph
  datePublished: string | null;
  sourceUrl: string;
}

/**
 * Try to extract JSON-LD Article metadata (headline, datePublished) from a page.
 */
function extractJsonLd(html: string): { headline?: string; datePublished?: string } {
  const match = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return {};
  try {
    const data = JSON.parse(match[1]) as Record<string, unknown>;
    return {
      headline:      typeof data.headline === 'string' ? data.headline : undefined,
      datePublished: typeof data.datePublished === 'string' ? data.datePublished : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Scrape a single page and return one ScrapeHit per (url, locationSlug).
 * Multi-paragraph hits for the same location are collapsed: if we already
 * have a hit for that slug on this page, we keep the first one.
 */
export async function scrapePage(url: string): Promise<ScrapeHit[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_UA },
  });

  if (!res.ok) {
    console.warn(`[jrps] fetch ${url} → ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const { headline: jsonLdHeadline, datePublished } = extractJsonLd(html);

  // Map: locationSlug → first matching paragraph text (used as fallback reason)
  const slugToFirstParagraph = new Map<string, string>();

  // WordPress typical selectors for news index + individual posts
  const selectors = [
    'article h2', 'article h3',
    'article p',
    'h1.entry-title', 'h2.entry-title', 'h3.entry-title',
    '.entry-summary p', '.entry-content p',
    '.post-title', '.post-excerpt',
    'h1.page-title', '.page-content p',
    // jamesriverpark.org specific
    '.hentry h2', '.hentry p',
  ];

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 15) return;

      const locationSlug = matchesLocationKeyword(text);
      if (!locationSlug) return;
      if (!hasClosureKeyword(text)) return;

      // Keep only the first paragraph match for each location
      if (!slugToFirstParagraph.has(locationSlug)) {
        slugToFirstParagraph.set(locationSlug, text);
      }
    });
  }

  // Special case: the pipeline trail page should always produce a hit even if
  // its body text doesn't have a classic closure keyword in a short paragraph.
  // Check the page title / h1 directly.
  if (slugToFirstParagraph.size === 0 && url.includes('pipeline')) {
    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (h1 && matchesLocationKeyword(h1)) {
      slugToFirstParagraph.set('pipeline-trail', h1);
    }
  }

  // Build one ScrapeHit per (url, locationSlug). Reason = JSON-LD headline
  // (most informative, page-level title) if available, else the first
  // matching paragraph for that location.
  const hits: ScrapeHit[] = [];
  for (const [locationSlug, firstParagraph] of slugToFirstParagraph) {
    hits.push({
      locationSlug,
      reason:        jsonLdHeadline ?? firstParagraph,
      datePublished: datePublished ?? null,
      sourceUrl:     url,
    });
  }

  return hits;
}

async function runJrpsSource(): Promise<RunResult> {
  // Check robots.txt
  const targetPaths = SCRAPE_PAGES.map((p) => new URL(p.url).pathname);
  const allowed = await isAllowedByRobots(ROBOTS_URL, targetPaths);
  if (!allowed) {
    return { ok: false, rowsWritten: 0, error: 'robots.txt disallows access' };
  }

  const supabase = await createServerClient('service');

  const { data: locationRows, error: locErr } = await supabase
    .from('locations')
    .select('id, slug')
    .eq('kind', 'access_point');

  if (locErr) {
    return { ok: false, rowsWritten: 0, error: `location lookup failed: ${locErr.message}` };
  }

  const slugToId = new Map<string, string>(
    (locationRows ?? []).map((l) => [l.slug, l.id]),
  );

  const allHits: ScrapeHit[] = [];
  for (const { url } of SCRAPE_PAGES) {
    const hits = await scrapePage(url);
    allHits.push(...hits);
    await sleep(1000);
  }

  if (allHits.length === 0) {
    return { ok: true, rowsWritten: 0 };
  }

  // Natural-key dedup: one draft per (source_url, location_id)
  const existingKeys = await loadExistingKeys(supabase, SOURCE_NAME);

  let rowsWritten = 0;
  const errors: string[] = [];

  for (const hit of allHits) {
    const locationId = slugToId.get(hit.locationSlug) ?? null;
    const fallbackId = locationId ?? slugToId.get('belle-isle') ?? slugToId.values().next().value ?? null;

    if (!fallbackId) {
      errors.push(`no location_id for hit: ${hit.reason.slice(0, 60)}`);
      continue;
    }

    const key = naturalKey(hit.sourceUrl, fallbackId);
    if (existingKeys.has(key)) continue;

    const { error: insertErr } = await supabase.from('location_status').insert({
      location_id:    fallbackId,
      kind:           'closed',
      state:          'draft',
      reason:         hit.reason,
      source:         SOURCE_NAME,
      source_url:     hit.sourceUrl,
      affects:        locationId ? null : 'See source URL for details',
      effective_from: hit.datePublished ? hit.datePublished.slice(0, 10) : undefined,
      created_by:     'scraper',
    });

    if (insertErr) {
      errors.push(`insert failed: ${insertErr.message}`);
    } else {
      rowsWritten++;
    }
  }

  if (errors.length > 0) {
    console.error('[jrps] errors:', errors);
  }

  return {
    ok:          errors.length === 0,
    rowsWritten,
    error:       errors.length > 0 ? errors.join('; ') : undefined,
  };
}

export const jrpsSource: ClosureSource = {
  name: 'jrps',
  run:  runJrpsSource,
};

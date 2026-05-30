/**
 * Venture Richmond closure source.
 *
 * Targets:
 *   https://venturerichmond.com/news/           — main news index
 *   https://venturerichmond.com/browns-island-improvement-plan/ — specific project page
 *
 * robots.txt is checked at scrape time. If either path is disallowed, the
 * source returns { ok: false, rowsWritten: 0, error: 'robots.txt disallows access' }
 * so other closure sources continue unaffected.
 *
 * Polite scraping:
 *   User-Agent: rva-james-bot (https://rvajames.org) — see lib/ingest/user-agent.ts
 *   ≥ 1 s delay between page fetches
 *   No parallel fetches
 *
 * Draft rows only — never auto-approved. Admin reviews at /admin/closures.
 *
 * Dedup (2026-05-28 refactor): natural key = `${source_url}::${location_id}`.
 * One draft per (article URL, location). Replaces text-hash comparison which
 * was fragile across reason-text reformatting.
 */

import * as cheerio from 'cheerio/slim';
import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from '@/lib/ingest/run';
import type { ClosureSource } from '@/lib/ingest/closures/registry';
import { naturalKey, loadExistingKeys } from '@/lib/ingest/closures/dedup';
import { BOT_USER_AGENT, BOT_NAME } from '@/lib/ingest/user-agent';

const SOURCE_NAME = 'Venture Richmond';
const BOT_UA = BOT_USER_AGENT;
const ROBOTS_URL = 'https://venturerichmond.com/robots.txt';

const SCRAPE_PAGES = [
  { url: 'https://venturerichmond.com/news/',                          label: 'News index' },
  { url: 'https://venturerichmond.com/browns-island-improvement-plan/', label: "Brown's Island project" },
];

/** Our 10 location slugs (pipeline-trail added in sub-goal 61) */
const LOCATION_KEYWORDS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /pipeline\s+trail/i,  slug: 'pipeline-trail'   },
  { pattern: /pony\s+pasture/i,    slug: 'pony-pasture'     },
  { pattern: /texas\s+beach/i,     slug: 'texas-beach'      },
  { pattern: /belle\s+isle/i,      slug: 'belle-isle'       },
  { pattern: /browns?\s+island/i,  slug: 'browns-island'    },
  { pattern: /mayo\s+island/i,     slug: 'mayo-island'      },
  { pattern: /shiplock/i,          slug: 'shiplock-trail'   },
  { pattern: /north\s+bank/i,      slug: 'north-bank-trail' },
  { pattern: /buttermilk/i,        slug: 'buttermilk-trail' },
  { pattern: /pump\s+house/i,      slug: 'pump-house'       },
  { pattern: /reedy\s+creek/i,     slug: 'reedy-creek'      },
  { pattern: /tredegar/i,          slug: 'tredegar'         },
  { pattern: /james\s+river\s+park/i, slug: 'belle-isle'   }, // park-wide; fall back to belle-isle
];

const CLOSURE_KEYWORDS = [
  /\bclosed\b/i,
  /\bclosure\b/i,
  /\bconstruction\b/i,
  /\baccess\b/i,
  /\breopen/i,
  /\binaccessible\b/i,
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
 * Parse robots.txt and return whether the given path is allowed for our bot.
 * Conservative: if parsing fails, assume allowed (fail open so we don't
 * silently suppress the source on every network blip).
 */
async function isAllowedByRobots(robotsUrl: string, targetPaths: string[]): Promise<boolean> {
  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': BOT_UA },
    });
    if (!res.ok) return true; // Can't read robots.txt — assume allowed

    const text = await res.text();
    const lines = text.split('\n').map((l) => l.trim());

    let inOurBlock = false;
    const disallowedPaths: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.slice('user-agent:'.length).trim().toLowerCase();
        inOurBlock = agent === '*' || agent === BOT_NAME;
        if (!inOurBlock) disallowedPaths.length = 0; // reset if leaving our block
      } else if (inOurBlock && line.toLowerCase().startsWith('disallow:')) {
        const path = line.slice('disallow:'.length).trim();
        if (path) disallowedPaths.push(path);
      }
    }

    for (const targetPath of targetPaths) {
      for (const disallowed of disallowedPaths) {
        if (targetPath.startsWith(disallowed)) {
          console.warn(`[venture-richmond] robots.txt disallows ${targetPath} (rule: ${disallowed})`);
          return false;
        }
      }
    }
    return true;
  } catch {
    return true; // Network error reading robots.txt — assume allowed
  }
}

export interface ScrapeHit {
  locationSlug: string;
  text: string;
  sourceUrl: string;
}

export async function scrapePage(url: string): Promise<ScrapeHit[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_UA },
  });

  if (!res.ok) {
    console.warn(`[venture-richmond] fetch ${url} → ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Map: locationSlug → first matching text (one hit per location per page)
  const slugToFirstText = new Map<string, string>();

  // Article titles and excerpts on the news index
  const selectors = [
    'article h2', 'article h3',
    'article p',
    '.entry-title', '.entry-summary', '.entry-content p',
    'h1.page-title', '.page-content p',
    // WordPress typical markup
    '.post-title', '.post-excerpt',
    'h2 a', 'h3 a',
  ];

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 15) return;

      const locationSlug = matchesLocationKeyword(text);
      const closureMatch = hasClosureKeyword(text);

      // Must match a location AND have a closure keyword
      if (!locationSlug || !closureMatch) return;

      // Keep only the first match per location
      if (!slugToFirstText.has(locationSlug)) {
        slugToFirstText.set(locationSlug, text);
      }
    });
  }

  const hits: ScrapeHit[] = [];
  for (const [locationSlug, text] of slugToFirstText) {
    hits.push({ locationSlug, text, sourceUrl: url });
  }

  return hits;
}

async function runVentureRichmondSource(): Promise<RunResult> {
  // Check robots.txt first
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

  // Scrape pages sequentially with polite delay
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
      errors.push(`no location_id for hit: ${hit.text.slice(0, 60)}`);
      continue;
    }

    const key = naturalKey(hit.sourceUrl, fallbackId);
    if (existingKeys.has(key)) continue;

    const { error: insertErr } = await supabase.from('location_status').insert({
      location_id: fallbackId,
      kind:        'closed',
      state:       'draft',
      reason:      hit.text,
      source:      SOURCE_NAME,
      source_url:  hit.sourceUrl,
      affects:     locationId ? null : 'See source URL for details',
      created_by:  'scraper',
    });

    if (insertErr) {
      errors.push(`insert failed: ${insertErr.message}`);
    } else {
      rowsWritten++;
    }
  }

  if (errors.length > 0) {
    console.error('[venture-richmond] errors:', errors);
  }

  return {
    ok:          errors.length === 0,
    rowsWritten,
    error:       errors.length > 0 ? errors.join('; ') : undefined,
  };
}

export const ventureRichmondSource: ClosureSource = {
  name: 'venture-richmond',
  run:  runVentureRichmondSource,
};

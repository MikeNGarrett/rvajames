/**
 * RVA.gov James River Park System closures scraper.
 *
 * Targets:
 *   https://www.rva.gov/parks-recreation/james-river-park-system
 *   https://www.rva.gov/press-releases-and-announcements-public-utilities/news
 *
 * The City of Richmond parks pages embed closure notices as plain body
 * paragraphs (Drupal CMS, .field--name-body selector). There are no
 * structured alert elements. Paragraphs starting with "Notice:" or
 * containing "closed"/"restricted"/"warning" are captured.
 *
 * The DPU press-release index is also scraped to catch infrastructure-related
 * closures (e.g. Pipeline Trail) that are announced via DPU rather than Parks.
 *
 * Dedup (2026-05-28 refactor): natural key = `${source_url}::${location_id}`.
 * One draft per (page URL, location). Replaces text-hash comparison which
 * was fragile and could silently re-insert on minor text changes.
 *
 * Cron: piggybacked on the usgs-percentiles 0 3 * * * daily trigger
 * via runAllClosureSources() in lib/ingest/closures/run-all.ts.
 */

// Use cheerio/slim to avoid the undici dependency (cheerio's fromURL helper
// pulls in undici which references MessagePort — not available in CF Workers).
import * as cheerio from 'cheerio/slim';
import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from '@/lib/ingest/run';
import type { ClosureSource } from '@/lib/ingest/closures/registry';
import { naturalKey, loadExistingKeys } from '@/lib/ingest/closures/dedup';

const SOURCE_NAME = 'rva.gov parks scrape';

const SCRAPE_PAGES: Array<{ url: string; label: string }> = [
  {
    url: 'https://www.rva.gov/parks-recreation/james-river-park-system',
    label: 'James River Park System',
  },
  {
    url: 'https://www.rva.gov/press-releases-and-announcements-public-utilities/news',
    label: 'DPU Press Releases',
  },
];

/**
 * Maps text fragments to location slugs by keyword.
 * Ordered longest-match-first to prefer more specific patterns.
 */
const LOCATION_KEYWORDS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /pipeline\s+trail/i,  slug: 'pipeline-trail'  },
  { pattern: /pony\s+pasture/i,    slug: 'pony-pasture'    },
  { pattern: /texas\s+beach/i,     slug: 'texas-beach'     },
  { pattern: /belle\s+isle/i,      slug: 'belle-isle'      },
  { pattern: /browns?\s+island/i,  slug: 'browns-island'   },
  { pattern: /mayo\s+island/i,     slug: 'mayo-island'     },
  { pattern: /shiplock/i,          slug: 'shiplock-trail'  },
  { pattern: /north\s+bank/i,      slug: 'north-bank-trail'},
  { pattern: /buttermilk/i,        slug: 'buttermilk-trail'},
  { pattern: /pump\s+house/i,      slug: 'pump-house'      },
  { pattern: /reedy\s+creek/i,     slug: 'reedy-creek'     },
  { pattern: /tredegar/i,          slug: 'tredegar'        },
];

/** Keywords that indicate a paragraph is closure-relevant. */
const CLOSURE_PATTERNS = [
  /\bnotice\s*:/i,
  /\bclosed\b/i,
  /\bclosure\b/i,
  /\brestricted\b/i,
  /\btemporarily\s+unavailable\b/i,
  /\binaccessible\b/i,
  /\bwash(?:ed)?\s+out\b/i,
];

function isClosure(text: string): boolean {
  return CLOSURE_PATTERNS.some((re) => re.test(text));
}

function matchLocationSlug(text: string): string | null {
  for (const { pattern, slug } of LOCATION_KEYWORDS) {
    if (pattern.test(text)) return slug;
  }
  return null;
}

export interface ScrapeHit {
  locationSlug: string | null;
  text: string;
  sourceUrl: string;
}

export async function scrapePage(url: string): Promise<ScrapeHit[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'rva-james-bot (mike.garrett@teamcolab.com)',
    },
  });

  if (!res.ok) {
    console.warn(`[rva-gov] fetch ${url} → ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Map: locationSlug (or 'null') → first matching text, one hit per location
  const slugToFirstText = new Map<string, string>();

  // Drupal CMS selectors — rva.gov uses several paragraph/section patterns:
  //   .field--name-body          classic body field (paragraphs, list items)
  //   .paragraph__column         bp-simple / bp-columns paragraph bundles (h3 notices)
  //   .views-element-container   views blocks that embed formatted content
  const selectors = [
    '.field--name-body p',
    '.field--name-body li',
    '.field--name-body h2',
    '.field--name-body h3',
    '.paragraph__column h3',
    '.paragraph__column h4',
    '.paragraph__column p',
    '.views-element-container p',
    '.views-element-container h3',
    // DPU press release index — article titles / teaser text
    '.views-row .views-field-title',
    '.views-row .views-field-body',
    '.views-row .views-field-field-summary',
    'article .node__title',
    'article .field--name-body p',
  ];

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 15) return;
      if (!isClosure(text)) return;

      const slug = matchLocationSlug(text) ?? '__park_wide__';
      if (!slugToFirstText.has(slug)) {
        slugToFirstText.set(slug, text);
      }
    });
  }

  const hits: ScrapeHit[] = [];
  for (const [slug, text] of slugToFirstText) {
    hits.push({
      locationSlug: slug === '__park_wide__' ? null : slug,
      text,
      sourceUrl: url,
    });
  }

  return hits;
}

async function runRvaGovSource(): Promise<RunResult> {
  const supabase = await createServerClient('service');

  // Fetch all location slugs so we can look up UUIDs
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

  // Scrape all pages sequentially (polite — public-sector site)
  const allHits: ScrapeHit[] = [];
  for (const { url } of SCRAPE_PAGES) {
    const hits = await scrapePage(url);
    allHits.push(...hits);
    // Small delay between pages
    await new Promise((r) => setTimeout(r, 500));
  }

  if (allHits.length === 0) {
    return { ok: true, rowsWritten: 0 };
  }

  // Natural-key dedup: one draft per (source_url, location_id)
  const existingKeys = await loadExistingKeys(supabase, SOURCE_NAME);

  let rowsWritten = 0;
  const errors: string[] = [];

  for (const hit of allHits) {
    // Try to resolve a location_id from the hit text
    const locationId = hit.locationSlug ? slugToId.get(hit.locationSlug) ?? null : null;

    // Use the first access-point location as a fallback for park-wide notices
    const fallbackLocationId =
      locationId ?? slugToId.get('belle-isle') ?? slugToId.values().next().value ?? null;

    if (!fallbackLocationId) {
      errors.push(`no location_id available for hit: ${hit.text.slice(0, 60)}`);
      continue;
    }

    const key = naturalKey(hit.sourceUrl, fallbackLocationId);
    if (existingKeys.has(key)) continue;

    const { error: insertErr } = await supabase.from('location_status').insert({
      location_id: fallbackLocationId,
      kind:         'closed',           // conservative default; admin sets actual kind on approve
      state:        'draft',
      reason:       hit.text,
      source:       SOURCE_NAME,
      source_url:   hit.sourceUrl,
      affects:      hit.locationSlug
        ? null                          // location-specific: affects the whole location
        : 'See source URL for details', // park-wide notice without specific location
      created_by: 'scraper',
    });

    if (insertErr) {
      errors.push(`insert failed: ${insertErr.message}`);
    } else {
      rowsWritten++;
    }
  }

  if (errors.length > 0) {
    console.error('[rva-gov] errors:', errors);
  }

  return {
    ok:          errors.length === 0,
    rowsWritten,
    error:       errors.length > 0 ? errors.join('; ') : undefined,
  };
}

export const rvaGovSource: ClosureSource = {
  name: 'rva-gov',
  run:  runRvaGovSource,
};

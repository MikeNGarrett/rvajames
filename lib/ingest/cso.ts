import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from './run';

// Richmond DPU Combined Sewer Overflow advisories
//
// The original URLs (combined-sewer-overflow-advisories RSS and
// combined-sewer-overflow-advisory HTML) both return 404 as of 2026-05-24 —
// these pages were never published or were removed.
//
// Current strategy:
//   Primary:  DPU news RSS (taxonomy/term/92/feed) — filter for CSO keywords
//   Fallback: Wastewater utility page — look for advisory notice text
//
// "0 rows written" is the correct outcome when there is no active CSO advisory.
// When a source returns 4xx we log a warning and return ok:true so the
// ingestion_runs row reflects the unavailability rather than treating it as
// "no advisory".
//
// Dedup: source_id = hashToHex16(headline + '\0' + effectiveFrom).
// The DPU RSS does not expose a per-event GUID, so we derive a deterministic
// 16-hex-char fingerprint. Re-running the same scrape produces the same
// source_id → upsert is a no-op. New advisories get new source_ids.

const DPU_RSS_URL  = 'https://www.rva.gov/taxonomy/term/92/feed';
const DPU_HTML_URL = 'https://www.rva.gov/public-utilities/wastewater-utility';

// CSO advisories expire after 3 days if not renewed.
// (Unlike JRA weekly samples, CSO events are tied to rain events and typically
// resolve within hours; 3 days is a conservative upper bound.)
const CSO_TTL_DAYS = 3;

interface CsoAdvisory {
  headline: string;
  body: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * Deterministic 16-hex-char fingerprint of a string.
 * Two DJB2 variants → 64 bits of output — sufficient for CSO dedup
 * (there are at most a handful of active advisories at any time).
 * Sync and dependency-free; avoids async Web Crypto for a tiny dataset.
 */
function hashToHex16(str: string): string {
  let a = 5381, b = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a, 33) ^ c;
    b = Math.imul(b, 65521) ^ c;
  }
  const hi = (a >>> 0).toString(16).padStart(8, '0');
  const lo = (b >>> 0).toString(16).padStart(8, '0');
  return hi + lo;
}

function parseRssDate(str: string): string {
  try {
    return new Date(str).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Try the DPU news RSS feed. Filter items whose title or description
 * mention combined sewer overflow / CSO keywords.
 *
 * Returns:
 *   CsoAdvisory[] (possibly empty) — source reachable, may have CSO items
 *   null                           — source unreachable (HTTP error / network)
 */
async function tryRssFeed(): Promise<CsoAdvisory[] | null> {
  try {
    const resp = await fetch(DPU_RSS_URL, {
      headers: { 'User-Agent': 'rva-james (mike.garrett@teamcolab.com)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.warn(`[cso] DPU RSS returned HTTP ${resp.status}`);
      return null;
    }
    const text = await resp.text();

    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    if (!items.length) return [];

    const advisories: CsoAdvisory[] = [];
    for (const [, itemXml] of items) {
      const title   = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? '';
      const desc    = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() ?? '';
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();

      const combined = `${title} ${desc}`;
      if (/cso|combined sewer|sewer overflow/i.test(combined)) {
        advisories.push({
          headline: title || 'CSO Advisory — Combined Sewer Overflow',
          body:     desc.replace(/<[^>]+>/g, '').trim() ||
                    'Richmond DPU has issued a combined sewer overflow advisory. Avoid contact with river water near outfall locations.',
          effectiveFrom: pubDate ? parseRssDate(pubDate) : new Date().toISOString(),
          effectiveTo:   null,
        });
      }
    }

    return advisories;
  } catch {
    return null;
  }
}

/**
 * Scrape the wastewater utility page for an advisory notice.
 *
 * Returns:
 *   CsoAdvisory[] (possibly empty) — page loaded; empty = no active advisory
 *   null                           — page unreachable
 */
async function tryHtmlScrape(): Promise<CsoAdvisory[] | null> {
  try {
    const resp = await fetch(DPU_HTML_URL, {
      headers: { 'User-Agent': 'rva-james (mike.garrett@teamcolab.com)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      console.warn(`[cso] Wastewater page returned HTTP ${resp.status}`);
      return null;
    }
    const html = await resp.text();

    // Check for an explicit "no current advisory" statement
    if (/no (current|active) (cso|advisory|overflow)/i.test(html)) {
      return [];
    }

    // Check for signs of an active overflow advisory
    const isActive = /combined sewer overflow (advisory|alert|warning|in effect|is active)/i.test(html);
    if (!isActive) return [];

    const dateMatch = html.match(/(\w+ \d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
    return [{
      headline: 'CSO Advisory — Combined Sewer Overflow in effect',
      body:     'Richmond DPU has issued a combined sewer overflow advisory. Avoid contact with river water near outfall locations.',
      effectiveFrom: dateMatch ? parseRssDate(dateMatch[1]) : new Date().toISOString(),
      effectiveTo:   null,
    }];
  } catch {
    return null;
  }
}

export async function runCsoIngestion(): Promise<RunResult> {
  const supabase = await createServerClient('service');
  let rowsWritten = 0;

  // Try RSS first; if it returns null (unreachable) try HTML scrape.
  // If both return null, log a warning but don't write an advisory — we
  // can't tell whether there's an active event or the source is just down.
  const rssSamples  = await tryRssFeed();
  const htmlSamples = rssSamples === null ? await tryHtmlScrape() : null;

  if (rssSamples === null && htmlSamples === null) {
    console.warn('[cso] Both DPU RSS and wastewater page were unreachable — skipping.');
    return {
      ok: true,
      rowsWritten: 0,
      error: 'Both CSO sources unreachable (DPU RSS + wastewater page returned non-200)',
    };
  }

  const advisories = rssSamples ?? htmlSamples ?? [];

  if (!advisories.length) {
    // Sources reachable, no active CSO advisory — correct outcome.
    return { ok: true, rowsWritten: 0 };
  }

  // CSO affects all swimming-tagged river-access locations
  const { data: riverLocations } = await supabase
    .from('locations')
    .select('id')
    .contains('tags', ['swimming']);

  const locationIds = riverLocations?.map((l) => l.id) ?? [];

  const ttlMs = CSO_TTL_DAYS * 24 * 60 * 60 * 1000;

  for (const advisory of advisories) {
    const effectiveTo = advisory.effectiveTo
      ?? new Date(new Date(advisory.effectiveFrom).getTime() + ttlMs).toISOString();

    // Deterministic source_id: fingerprint of headline + effectiveFrom.
    // Re-scraping the same event produces the same id → upsert is a no-op.
    const source_id = hashToHex16(advisory.headline + '\0' + advisory.effectiveFrom);

    const { error } = await supabase.from('advisories').upsert({
      source:         'rva_dpu',
      source_id,
      kind:           'cso_overflow',
      severity:       'high',
      headline:       advisory.headline,
      body:           advisory.body,
      effective_from: advisory.effectiveFrom,
      effective_to:   effectiveTo,
      location_ids:   locationIds,
    }, { onConflict: 'source,source_id' });

    if (!error) rowsWritten++;
  }

  console.log(`[cso] Wrote ${rowsWritten} advisory rows.`);
  return { ok: true, rowsWritten };
}

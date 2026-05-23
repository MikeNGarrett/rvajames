import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from './run';

// Richmond DPU Combined Sewer Overflow advisories
// Try RSS first, fall back to HTML scrape
const CSO_RSS_URL = 'https://www.rva.gov/public-utilities/rss/combined-sewer-overflow-advisories';
const CSO_HTML_URL = 'https://www.rva.gov/public-utilities/combined-sewer-overflow-advisory';

interface CsoAdvisory {
  headline: string;
  body: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

function parseRssDate(str: string): string {
  try {
    return new Date(str).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function tryRssFeed(): Promise<CsoAdvisory[] | null> {
  try {
    const resp = await fetch(CSO_RSS_URL, {
      headers: { 'User-Agent': 'rva-james (mike.garrett@teamcolab.com)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();

    // Parse RSS items with regex (avoids DOMParser dependency in Workers)
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    if (!items.length) return null;

    const advisories: CsoAdvisory[] = [];
    for (const [, itemXml] of items) {
      const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
      const desc = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim();
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();

      if (title && /cso|sewer|overflow|advisory/i.test(title)) {
        advisories.push({
          headline: title,
          body: desc?.replace(/<[^>]+>/g, '') ?? '',
          effectiveFrom: pubDate ? parseRssDate(pubDate) : new Date().toISOString(),
          effectiveTo: null,
        });
      }
    }

    return advisories.length ? advisories : null;
  } catch {
    return null;
  }
}

async function tryHtmlScrape(): Promise<CsoAdvisory[] | null> {
  try {
    const resp = await fetch(CSO_HTML_URL, {
      headers: { 'User-Agent': 'rva-james (mike.garrett@teamcolab.com)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Check for "no current advisory" state
    if (/no (current|active) (cso|advisory|overflow)/i.test(html)) {
      return [];
    }

    // Look for advisory date patterns like "May 23, 2026" or "2026-05-23"
    const dateMatch = html.match(/(\w+ \d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
    const isActive = /active|in effect|overflow (is|are) (occurring|active)/i.test(html);

    if (!isActive) return [];

    return [{
      headline: 'CSO Advisory — Combined Sewer Overflow in effect',
      body: 'Richmond DPU has issued a combined sewer overflow advisory. Avoid contact with river water near outfall locations.',
      effectiveFrom: dateMatch ? parseRssDate(dateMatch[1]) : new Date().toISOString(),
      effectiveTo: null,
    }];
  } catch {
    return null;
  }
}

export async function runCsoIngestion(): Promise<RunResult> {
  const advisories = (await tryRssFeed()) ?? (await tryHtmlScrape());
  const supabase = await createServerClient('service');
  let rowsWritten = 0;

  if (!advisories?.length) {
    // No active CSO — log ok with 0 rows as per spec
    return { ok: true, rowsWritten: 0 };
  }

  // CSO affects all river-access locations
  const { data: riverLocations } = await supabase
    .from('locations')
    .select('id')
    .contains('tags', ['swimming']);

  const locationIds = riverLocations?.map((l) => l.id) ?? [];

  for (const advisory of advisories) {
    const { error } = await supabase.from('advisories').insert({
      source: 'rva_dpu',
      kind: 'cso_overflow',
      severity: 'high',
      headline: advisory.headline,
      body: advisory.body,
      effective_from: advisory.effectiveFrom,
      effective_to: advisory.effectiveTo,
      location_ids: locationIds,
    });
    if (!error) rowsWritten++;
  }

  return { ok: true, rowsWritten };
}

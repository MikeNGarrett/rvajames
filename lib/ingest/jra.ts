import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { RunResult } from './run';

// James River Association water quality monitoring
// Primary: try JSON API endpoint; fallback: parse known HTML table structure
const JRA_JSON_URL = 'https://www.thejamesriver.org/wp-json/jra/v1/water-quality';
const JRA_HTML_URL = 'https://www.thejamesriver.org/james-river-watch/';

// JRA maps to RVA James location slugs
const JRA_SITE_MAP: Record<string, string[]> = {
  'belle-isle':   ['belle-isle'],
  'pony-pasture': ['pony-pasture'],
  'richmond':     ['belle-isle', 'browns-island', 'mayo-island'],
};

interface JraSample {
  site: string;
  date: string;
  safe: boolean;
  ecoli?: number;
  note?: string;
}

async function tryJsonEndpoint(): Promise<JraSample[] | null> {
  try {
    const resp = await fetch(JRA_JSON_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'rva-james (mike.garrett@teamcolab.com)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data)) return null;
    return data as JraSample[];
  } catch {
    return null;
  }
}

async function tryHtmlScrape(): Promise<JraSample[] | null> {
  try {
    const resp = await fetch(JRA_HTML_URL, {
      headers: { 'User-Agent': 'rva-james (mike.garrett@teamcolab.com)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Look for embedded JSON in the page (common WP pattern)
    const jsonMatch = html.match(/var\s+jraWaterQuality\s*=\s*(\{[\s\S]*?\});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (Array.isArray(data.samples)) return data.samples as JraSample[];
      } catch { /* fall through */ }
    }

    // Parse common "safe / not safe" status from page text
    const safeMatch = html.match(/class="[^"]*water-quality[^"]*"[^>]*>([^<]+)</i);
    const isSafe = safeMatch ? !/not safe|unsafe|advisory|closed/i.test(safeMatch[1]) : true;

    return [{
      site: 'richmond',
      date: new Date().toISOString().split('T')[0],
      safe: isSafe,
      note: 'scraped from jra html',
    }];
  } catch {
    return null;
  }
}

export async function runJraIngestion(): Promise<RunResult> {
  const samples = (await tryJsonEndpoint()) ?? (await tryHtmlScrape());

  const supabase = await createServerClient('service');
  let rowsWritten = 0;

  if (!samples?.length) {
    // No data available — log a "no current sample" advisory
    const { data: belleLoc } = await supabase
      .from('locations')
      .select('id')
      .eq('slug', 'belle-isle')
      .single();

    if (belleLoc) {
      await supabase.from('advisories').insert({
        source: 'jra',
        kind: 'water_quality',
        severity: 'low',
        headline: 'No current JRA water quality sample available',
        body: 'James River Association has not published a water quality update for this period.',
        effective_from: new Date().toISOString(),
        effective_to: null,
        location_ids: [belleLoc.id],
      });
      rowsWritten++;
    }
    return { ok: true, rowsWritten };
  }

  for (const sample of samples) {
    const slugs = JRA_SITE_MAP[sample.site] ?? ['belle-isle'];
    const { data: locations } = await supabase
      .from('locations')
      .select('id')
      .in('slug', slugs);

    const locationIds = locations?.map((l) => l.id) ?? [];

    if (!sample.safe) {
      const { error } = await supabase.from('advisories').insert({
        source: 'jra',
        kind: 'swim_closure',
        severity: 'high',
        headline: `JRA water quality advisory — swimming not recommended`,
        body: sample.note ?? `E. coli levels exceed safe swimming thresholds${sample.ecoli ? ` (${sample.ecoli} CFU/100mL)` : ''}.`,
        effective_from: sample.date ? new Date(sample.date).toISOString() : new Date().toISOString(),
        effective_to: null,
        location_ids: locationIds,
      });
      if (!error) rowsWritten++;
    } else {
      // Safe — write a conditions snapshot noting water quality OK
      for (const loc of locations ?? []) {
        const { error } = await supabase.from('conditions_snapshots').insert({
          location_id: loc.id,
          source: 'jra',
          payload: sample as unknown as Json,
        });
        if (!error) rowsWritten++;
      }
    }
  }

  return { ok: true, rowsWritten };
}

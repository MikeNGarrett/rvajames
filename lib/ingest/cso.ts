/**
 * Richmond DPU Combined Sewer Overflow ingest — EmNet headless-browser strategy
 *
 * DPU retired its rva.gov CSO advisory pages (RSS + HTML) in 2026. The
 * authoritative real-time source is now the public EmNet map at
 * apps.emnet.net/richmond-pub-map-app. We fetch it via Cloudflare Browser
 * Rendering (headless Chrome) using the BROWSER binding.
 *
 * Sub-goal 82 (rva-james CSO plan)
 *
 * ── What this does ────────────────────────────────────────────────────────────
 *
 * 1. Launches a headless Chrome session to load the EmNet public map.
 * 2. Extracts all Richmond CSO monitoring + modeled sites.
 * 3. Upserts each site into the `cso_outfalls` catalog table.
 * 4. For any site that:
 *      a) affects the James River mainstem, AND
 *      b) had a discharge (cso_last_occurrence) within the last 48 hours,
 *    upserts an advisory into the `advisories` table with source='emnet_cso'.
 *
 * ── Advisory shape ────────────────────────────────────────────────────────────
 *
 *   source         = 'emnet_cso'
 *   source_id      = '{emnet_id}:{cso_last_occurrence_iso}'  — unique per event
 *   kind           = 'cso_overflow'
 *   severity       = 'high'
 *   outfall_id     = FK to cso_outfalls.id
 *   location_ids   = []  — per-location upstream check happens at query time
 *   effective_from = cso_last_occurrence
 *   effective_to   = cso_last_occurrence + 48h
 *
 * ── Schedule ─────────────────────────────────────────────────────────────────
 *
 * Reuses the existing CSO cron trigger: 0 6,18 * * * (twice daily).
 * The Cloudflare free-tier cron limit (5 triggers) is saturated — no new
 * trigger is added; this ingest replaces the cso.ts internals only.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from './run';
import type { BrowserWorker } from '@cloudflare/puppeteer';
import {
  fetchEmnetSites,
  buildSourceId,
  buildAdvisoryHeadline,
  buildAdvisoryBody,
  isWithinWindow,
} from './cso-emnet';

/** CSO advisory window: 48h from last discharge event */
const CSO_WINDOW_HOURS = 48;

export async function runCsoIngestion(): Promise<RunResult> {
  // ── Get Cloudflare BROWSER binding ────────────────────────────────────────
  // The BROWSER binding (wrangler.jsonc "browser": { "binding": "BROWSER" })
  // is only available in the Workers runtime. In `next dev`, getCloudflareContext
  // throws → return a clear error rather than crashing.
  let browserBinding: BrowserWorker;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as Record<string, unknown>)['BROWSER'];
    if (!binding) {
      return {
        ok: false,
        rowsWritten: 0,
        error:
          '[cso] BROWSER binding not found in Cloudflare env. ' +
          'Ensure Workers Paid plan + Browser Rendering are enabled ' +
          'and wrangler.jsonc has the "browser" binding.',
      };
    }
    browserBinding = binding as unknown as BrowserWorker;
  } catch (err) {
    return {
      ok: false,
      rowsWritten: 0,
      error:
        `[cso] Cloudflare context unavailable (running in next dev?): ${String(err)}`,
    };
  }

  // ── Fetch sites from EmNet ─────────────────────────────────────────────────
  let sites: Awaited<ReturnType<typeof fetchEmnetSites>>;
  try {
    sites = await fetchEmnetSites(browserBinding);
  } catch (err) {
    return {
      ok: false,
      rowsWritten: 0,
      error: `[cso] EmNet fetch failed: ${String(err)}`,
    };
  }

  console.log(`[cso] Fetched ${sites.length} EmNet sites`);

  const supabase = await createServerClient('service');
  let rowsWritten = 0;
  const now = new Date().toISOString();

  // ── Process each site ──────────────────────────────────────────────────────
  for (const site of sites) {
    // 1. Upsert the outfall catalog entry.
    //    On conflict (emnet_id already exists), refresh last_seen_at + mutable fields.
    //    We always write back bodies/site_type in case the operator updates them.
    const { data: outfallRow, error: outfallError } = await supabase
      .from('cso_outfalls')
      .upsert(
        {
          emnet_id: site.emnetId,
          name: site.name,
          lat: site.lat,
          lng: site.lng,
          bodies: site.bodies,
          site_type: site.siteType,
          affects_james_mainstem: site.affectsJamesMainstem,
          last_seen_at: now,
        },
        { onConflict: 'emnet_id' },
      )
      .select('id')
      .single();

    if (outfallError || !outfallRow) {
      console.error(
        `[cso] outfall upsert failed for ${site.emnetId} (${site.name}):`,
        outfallError?.message ?? 'no row returned',
      );
      continue;
    }

    rowsWritten++; // count the outfall upsert

    // 2. Advisory — only for mainstem sites with a recent discharge event.
    if (
      !site.affectsJamesMainstem ||
      !site.csoLastOccurrence ||
      !isWithinWindow(site.csoLastOccurrence, CSO_WINDOW_HOURS)
    ) {
      continue; // no active advisory needed
    }

    const source_id = buildSourceId(site.emnetId, site.csoLastOccurrence);
    const effectiveTo = new Date(
      new Date(site.csoLastOccurrence).getTime() +
        CSO_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { error: advError } = await supabase.from('advisories').upsert(
      {
        source: 'emnet_cso',
        source_id,
        kind: 'cso_overflow',
        severity: 'high',
        outfall_id: outfallRow.id,
        headline: buildAdvisoryHeadline(site.name),
        body: buildAdvisoryBody(site.name, site.csoLastOccurrence),
        effective_from: site.csoLastOccurrence,
        effective_to: effectiveTo,
        location_ids: [], // upstream check happens at query time (sub-goal 83)
      },
      { onConflict: 'source,source_id' },
    );

    if (advError) {
      console.error(
        `[cso] advisory upsert failed for source_id ${source_id}:`,
        advError.message,
      );
    } else {
      rowsWritten++; // count the advisory upsert
      console.log(`[cso] active CSO at ${site.name} — advisory upserted`);
    }
  }

  console.log(
    `[cso] Done. ${rowsWritten} rows written (${sites.length} sites, ` +
      `${sites.filter((s) => s.affectsJamesMainstem && s.csoLastOccurrence && isWithinWindow(s.csoLastOccurrence, CSO_WINDOW_HOURS)).length} active mainstem events).`,
  );

  return { ok: true, rowsWritten };
}

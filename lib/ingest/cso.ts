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
 *      b) had a discharge (cso_last_occurrence) within the last 72 hours,
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
 *   effective_to   = cso_last_occurrence + 72h
 *
 * ── Schedule ─────────────────────────────────────────────────────────────────
 *
 * Reuses the existing CSO cron trigger: 0 6,18 * * * (twice daily).
 * The Cloudflare free-tier cron limit (5 triggers) is saturated — no new
 * trigger is added; this ingest replaces the cso.ts internals only.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createServerClient } from '@/lib/supabase/server';
import thresholds from '@/lib/safety/thresholds.json';
import type { RunResult } from './run';
import type { BrowserWorker } from '@cloudflare/puppeteer';
import {
  fetchEmnetSites,
  buildSourceId,
  buildAdvisoryHeadline,
  buildAdvisoryBody,
  selectAdvisoryBranch,
  advisoryEffectiveTo,
  resolveCurrentOverflow,
} from './cso-emnet';

/**
 * CSO advisory window — how long after a discharge bacterial levels stay
 * elevated. Single source of truth: thresholds.cso.swim_hold_hours, which the
 * upstream-CSO query also reads, so ingest and query can never drift apart.
 * VDH advises avoiding river water contact for 3 days (72h) after a discharge.
 */
const CSO_WINDOW_HOURS = thresholds.cso.swim_hold_hours;

/** Returns an ISO timestamp CSO_WINDOW_HOURS from now — used as advisory effective_to. */
function windowEndFromNow(): string {
  return new Date(Date.now() + CSO_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

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

  // Pre-load existing emnet_cso advisory source_ids so we can dedupe via a
  // natural-key SELECT-then-INSERT pattern. We can't use ON CONFLICT here:
  // the advisories.(source, source_id) uniqueness is enforced by a PARTIAL
  // unique index (WHERE source_id IS NOT NULL, per migration 0012), and
  // supabase-js's onConflict option only matches full unique constraints
  // — Postgres rejects with 42P10 ("no unique or exclusion constraint
  // matching the ON CONFLICT specification") otherwise.
  const { data: existingAdvisoryRows } = await supabase
    .from('advisories')
    .select('source_id')
    .eq('source', 'emnet_cso');
  const existingSourceIds = new Set(
    (existingAdvisoryRows ?? []).map((r) => r.source_id).filter((id) => id != null),
  );

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
          // Persist EmNet's cso_active_overflow flag so the metro summary can
          // distinguish "actively discharging" from "past 72h advisory." Guard
          // against EmNet's stuck-true flag (CSO 12, 2026-06-30): an active flag
          // with a stale occurrence isn't a live discharge, so resolveCurrentOverflow
          // stores false — otherwise the "actively discharging" count zombies too.
          current_overflow: resolveCurrentOverflow(site.overflow, site.csoLastOccurrence, CSO_WINDOW_HOURS),
          current_overflow_observed_at: now,
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

    // 2. Advisory — three branches per the sub-goal 94 design decision.
    const branch = selectAdvisoryBranch(site, CSO_WINDOW_HOURS);

    if (branch === 'active-overflow') {
      // ── Branch 1: site is actively discharging ─────────────────────────────
      // Bump the advisory for THIS EVENT (matched by source_id), or create a
      // new one. We key on source_id rather than "any open advisory for this
      // outfall" because that broader match caused a zombie-advisory bug
      // observed in production 2026-05-31: a July 2025 advisory got bumped
      // forward every time the same outfall transitioned to overflow=true at
      // any later ingest, regardless of which event was actually starting.
      // Result: a 2025-07-09 advisory still in effect in May 2026.
      //
      // With source_id (which embeds csoLastOccurrence), each discharge event
      // has its own advisory lifecycle. A *continuing* event keeps the same
      // csoLastOccurrence across ingests, so we bump the same row. A *new*
      // event (different csoLastOccurrence) creates a new advisory. Stale
      // advisories from past events are never extended again.
      const effectiveFrom = site.csoLastOccurrence ?? now;
      const sourceId      = buildSourceId(site.emnetId, effectiveFrom);
      // Anchor effective_to to the actual discharge event + window, NOT now+window.
      // EmNet's cso_active_overflow flag can stick "true" for weeks (observed on
      // CSO 12 in prod 2026-06-30: flag true, csoLastOccurrence frozen at 06-14).
      // A now+window bump re-extended that advisory every scrape → a 16-day zombie
      // overflow. Anchoring to csoLastOccurrence makes the advisory expire `window`
      // hours after the real event regardless of the flag, and makes the bump
      // idempotent (a stuck flag with a stale occurrence recomputes to a past
      // effective_to and self-expires). Fall back to now+window only when EmNet
      // reports an active overflow with no occurrence timestamp at all.
      const newEffectiveTo = site.csoLastOccurrence
        ? advisoryEffectiveTo(site.csoLastOccurrence, CSO_WINDOW_HOURS)
        : windowEndFromNow();

      const { data: existingAdvisory } = await supabase
        .from('advisories')
        .select('id')
        .eq('source', 'emnet_cso')
        .eq('source_id', sourceId)
        .maybeSingle();

      if (existingAdvisory) {
        // Same event continuing — refresh effective_to (occurrence + window).
        const { error: updateError } = await supabase
          .from('advisories')
          .update({ effective_to: newEffectiveTo })
          .eq('id', existingAdvisory.id);
        if (updateError) {
          console.error(`[cso] advisory bump failed for outfall ${site.name}:`, updateError.message);
        } else {
          rowsWritten++;
          console.log(`[cso] active CSO at ${site.name} (event ${effectiveFrom}) — advisory bumped to ${newEffectiveTo}`);
        }
      } else {
        // New event — insert. The (source, source_id) partial unique index
        // protects against races; existingSourceIds tracks what we've already
        // inserted this run.
        if (existingSourceIds.has(sourceId)) continue;

        const { error: insertError } = await supabase.from('advisories').insert({
          source: 'emnet_cso',
          source_id:      sourceId,
          kind:           'cso_overflow',
          severity:       'high',
          outfall_id:     outfallRow.id,
          headline:       buildAdvisoryHeadline(site.name),
          body:           buildAdvisoryBody(site.name, effectiveFrom),
          effective_from: effectiveFrom,
          effective_to:   newEffectiveTo,
          location_ids:   [],
        });
        if (insertError) {
          console.error(`[cso] advisory insert failed for ${site.name}:`, insertError.message);
        } else {
          rowsWritten++;
          existingSourceIds.add(sourceId);
          console.log(`[cso] active CSO at ${site.name} (event ${effectiveFrom}) — new advisory created`);
        }
      }
      continue;
    }

    if (branch === 'inactive-window') {
      // ── Branch 2: not actively discharging but recent event within 72h ────
      // Existing dedup-by-source_id logic (unchanged from original ingest).
      const source_id = buildSourceId(site.emnetId, site.csoLastOccurrence!);
      if (existingSourceIds.has(source_id)) continue;

      const effectiveTo = advisoryEffectiveTo(site.csoLastOccurrence!, CSO_WINDOW_HOURS);

      const { error: advError } = await supabase.from('advisories').insert({
        source: 'emnet_cso',
        source_id,
        kind: 'cso_overflow',
        severity: 'high',
        outfall_id: outfallRow.id,
        headline: buildAdvisoryHeadline(site.name),
        body: buildAdvisoryBody(site.name, site.csoLastOccurrence!),
        effective_from: site.csoLastOccurrence!,
        effective_to: effectiveTo,
        location_ids: [],
      });
      if (advError) {
        console.error(`[cso] advisory insert failed for source_id ${source_id}:`, advError.message);
      } else {
        rowsWritten++;
        existingSourceIds.add(source_id);
        console.log(`[cso] inactive-window CSO at ${site.name} — advisory inserted`);
      }
      continue;
    }

    // Branch 3: site.overflow === null (unknown state) — skip advisory logic.
  }

  const activeOverflowCount = sites.filter(
    (s) => s.affectsJamesMainstem && s.overflow === true,
  ).length;
  console.log(
    `[cso] Done. ${rowsWritten} rows written (${sites.length} sites, ` +
      `${activeOverflowCount} actively-discharging mainstem sites).`,
  );

  return { ok: true, rowsWritten };
}

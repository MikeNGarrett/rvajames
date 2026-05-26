/**
 * Derives water quality advisories from recent `water_quality_readings`.
 * Called after `runJraIngestion()` from the JRA cron route.
 *
 * Classification per station (14-day recency window only):
 *   - Both ecoli and enterococci null → skip (off-season / no sample)
 *   - Either non-null value exceeds VDH single-sample max → create advisory
 *   - All non-null values within range → no advisory (safe)
 *
 * Severity bands (primary stations):
 *   - Exceeds threshold (E. coli > 235 or Enterococci > 104)    → 'moderate'
 *   - Exceeds 2× threshold (E. coli > 470 or Enterococci > 208) → 'high'
 *
 * Upstream watch stations always produce 'low' severity advisories
 * (12–24h leading indicator, not a confirmed direct hit).
 *
 * Idempotency: upsert on (source, source_id) where
 *   source    = 'jra_water_quality'   (canonical system name)
 *   source_id = '{code}:{date}'        (primary stations)
 *   source_id = 'upstream:{code}:{date}' (watch stations)
 * Re-running the same day produces 0 new rows.
 */

import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from './run';
import { ACCESS_POINT_STATIONS, JRA_STATIONS } from '@/lib/data/station-mapping';

// ── VDH single-sample recreational water thresholds ──────────────────────────

/** E. coli CFU/100mL — VDH single-sample maximum */
const ECOLI_MAX    = 235;
/** E. coli CFU/100mL — 2× threshold → 'high' severity */
const ECOLI_HIGH   = 235 * 2;
/** Enterococci CFU/100mL — VDH single-sample maximum */
const ENTERO_MAX   = 104;
/** Enterococci CFU/100mL — 2× threshold → 'high' severity */
const ENTERO_HIGH  = 104 * 2;

const RECENCY_DAYS = 14;  // only derive from readings within last 14 days
const TTL_DAYS     = 7;   // advisory expires after next sampling cycle

/** Canonical source system name for all JRA water-quality advisories. */
const SOURCE_SYSTEM = 'jra_water_quality';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReadingRow {
  station_code:              string | null;
  station_global_id:         string;
  organization:              string | null;
  collected_at:              string;
  ecoli_cfu_per_100ml:       number | null;
  enterococci_cfu_per_100ml: number | null;
}

export interface AdvisorySpec {
  severity: 'low' | 'moderate' | 'high';
  headline: string;
  body:     string;
}

// ── Classification (exported for unit testing) ────────────────────────────────

/**
 * Classifies a single reading into an advisory spec, or returns null if no
 * advisory should be created.
 *
 * @param reading       The reading row from water_quality_readings.
 * @param displayName   Human-readable station name for headline/body text.
 * @param isUpstreamWatch  When true, severity is capped at 'low' regardless of
 *                      the actual value — upstream exceedances are leading
 *                      indicators, not confirmed hits at the access point.
 */
export function classifyReading(
  reading: Pick<ReadingRow, 'ecoli_cfu_per_100ml' | 'enterococci_cfu_per_100ml' | 'collected_at' | 'organization'>,
  displayName: string,
  isUpstreamWatch: boolean,
): AdvisorySpec | null {
  const ecoli  = reading.ecoli_cfu_per_100ml;
  const entero = reading.enterococci_cfu_per_100ml;

  // No measurement — both null → skip (off-season / sample not yet processed)
  if (ecoli === null && entero === null) return null;

  // Explicit null guards — do NOT rely on `null > 235` evaluating falsy
  const ecoliExceeds = ecoli  !== null && ecoli  > ECOLI_MAX;
  const entExceeds   = entero !== null && entero > ENTERO_MAX;

  // Within range → no advisory
  if (!ecoliExceeds && !entExceeds) return null;

  // Exceeds threshold — determine severity band
  const ecoliHigh = ecoli  !== null && ecoli  > ECOLI_HIGH;
  const entHigh   = entero !== null && entero > ENTERO_HIGH;
  const isHigh    = ecoliHigh || entHigh;

  const severity: 'low' | 'moderate' | 'high' = isUpstreamWatch
    ? 'low'
    : (isHigh ? 'high' : 'moderate');

  const headline = isUpstreamWatch
    ? `Upstream watch — ${displayName}`
    : `Elevated bacteria at ${displayName}`;

  // Build body with the specific values that exceeded their thresholds
  const parts: string[] = [];
  if (ecoli !== null) parts.push(`E. coli ${ecoli} CFU/100mL (VDH limit 235)`);
  if (entero !== null) parts.push(`Enterococci ${entero} CFU/100mL (VDH limit 104)`);

  const sampleDate = new Date(reading.collected_at).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month:    'long',
    day:      'numeric',
    year:     'numeric',
  });
  const org = reading.organization ?? 'James River Association';

  const body = isUpstreamWatch
    ? `Elevated bacteria detected at ${displayName} (upstream station). This may indicate water quality concerns at nearby access points within 12–24 hours. ${parts.join('; ')}. Sampled ${sampleDate} by ${org}.`
    : `Elevated bacteria levels at ${displayName} exceed VDH recreational water guidelines. ${parts.join('; ')}. Sampled ${sampleDate} by ${org}.`;

  return { severity, headline, body };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Reads the latest in-window readings from `water_quality_readings`, applies
 * the classification rules, and upserts advisory rows into `advisories`.
 *
 * Idempotent: upsert on (source, source_id) is a no-op if the advisory for
 * the same station + date already exists.
 *
 * Returns `{ ok: true, rowsWritten: N }` where N is the count of upserted rows
 * (0 on re-runs within the same sampling cycle).
 */
export async function deriveWaterQualityAdvisories(): Promise<RunResult> {
  const supabase = await createServerClient('service');
  const now = new Date();
  const recencyCutoff = new Date(now.getTime() - RECENCY_DAYS * 24 * 60 * 60 * 1000);

  // ── Build station-code → slugs maps ─────────────────────────────────────────

  const primaryCodeToSlugs = new Map<string, string[]>();
  const watchCodeToSlugs   = new Map<string, string[]>();

  for (const [slug, config] of Object.entries(ACCESS_POINT_STATIONS)) {
    for (const s of config.primaryStations) {
      const existing = primaryCodeToSlugs.get(s.code) ?? [];
      primaryCodeToSlugs.set(s.code, [...existing, slug]);
    }
    for (const s of config.upstreamWatchStations ?? []) {
      const existing = watchCodeToSlugs.get(s.code) ?? [];
      watchCodeToSlugs.set(s.code, [...existing, slug]);
    }
  }

  const allCodes = new Set([...primaryCodeToSlugs.keys(), ...watchCodeToSlugs.keys()]);
  if (!allCodes.size) return { ok: true, rowsWritten: 0 };

  // ── Fetch latest reading per station within recency window ───────────────────

  const { data: readings, error: readError } = await supabase
    .from('water_quality_readings')
    .select('station_code,station_global_id,organization,collected_at,ecoli_cfu_per_100ml,enterococci_cfu_per_100ml')
    .in('station_code', [...allCodes])
    .gte('collected_at', recencyCutoff.toISOString())
    .order('collected_at', { ascending: false })
    .limit(200);

  if (readError) return { ok: false, rowsWritten: 0, error: readError.message };
  if (!readings?.length) return { ok: true, rowsWritten: 0 };

  // Keep only the most recent reading per station_code
  const latestByCode = new Map<string, ReadingRow>();
  for (const row of readings) {
    if (row.station_code && !latestByCode.has(row.station_code)) {
      latestByCode.set(row.station_code, row as ReadingRow);
    }
  }

  // ── Fetch location IDs for all access-point slugs ────────────────────────────

  const allSlugs = Object.keys(ACCESS_POINT_STATIONS);
  const { data: locations } = await supabase
    .from('locations')
    .select('id, slug')
    .in('slug', allSlugs);

  const locationIdBySlug = new Map<string, string>();
  for (const loc of locations ?? []) {
    locationIdBySlug.set(loc.slug, loc.id);
  }

  // ── Fetch existing active advisory source_ids for in-run dedup ──────────────
  // (The DB-level UNIQUE constraint handles cross-run dedup; this set prevents
  // double-inserts within the same run when multiple slugs share a station.)

  const { data: existingAdvisories } = await supabase
    .from('advisories')
    .select('source_id')
    .eq('kind', 'water_quality')
    .eq('source', SOURCE_SYSTEM)
    .gt('effective_to', now.toISOString());

  const existingSourceIds = new Set(
    existingAdvisories?.map((a) => a.source_id).filter(Boolean) ?? [],
  );

  // ── Upsert advisory rows for exceeding stations ──────────────────────────────

  let rowsWritten = 0;

  /**
   * Shared helper — upserts one advisory row keyed on (source, source_id).
   * Skips within-run duplicates using existingSourceIds.
   */
  async function maybeUpsert(
    sourceId:    string,
    spec:        AdvisorySpec,
    reading:     ReadingRow,
    locationIds: string[],
  ): Promise<void> {
    if (existingSourceIds.has(sourceId)) return;
    if (!locationIds.length) return;

    const effectiveFrom = new Date(reading.collected_at).toISOString();
    const effectiveTo   = new Date(
      new Date(reading.collected_at).getTime() + TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase.from('advisories').upsert({
      source:         SOURCE_SYSTEM,
      source_id:      sourceId,
      kind:           'water_quality',
      severity:       spec.severity,
      headline:       spec.headline,
      body:           spec.body,
      effective_from: effectiveFrom,
      effective_to:   effectiveTo,
      location_ids:   locationIds,
    }, { onConflict: 'source,source_id' });

    if (!error) {
      rowsWritten++;
      // Prevent duplicate upsert within the same run (multiple slugs → same station)
      existingSourceIds.add(sourceId);
    }
  }

  // Primary stations
  for (const [stationCode, slugs] of primaryCodeToSlugs) {
    const reading = latestByCode.get(stationCode);
    if (!reading) continue;

    const displayName = JRA_STATIONS[stationCode]?.displayName ?? stationCode;
    const spec = classifyReading(reading, displayName, false);
    if (!spec) continue;

    const readingDate = new Date(reading.collected_at).toISOString().slice(0, 10);
    const sourceId    = `${stationCode}:${readingDate}`;
    const locationIds = slugs.flatMap((s) => {
      const id = locationIdBySlug.get(s);
      return id ? [id] : [];
    });

    await maybeUpsert(sourceId, spec, reading, locationIds);
  }

  // Upstream watch stations
  for (const [stationCode, slugs] of watchCodeToSlugs) {
    const reading = latestByCode.get(stationCode);
    if (!reading) continue;

    const displayName = JRA_STATIONS[stationCode]?.displayName ?? stationCode;
    const spec = classifyReading(reading, displayName, true /* isUpstreamWatch */);
    if (!spec) continue;

    const readingDate = new Date(reading.collected_at).toISOString().slice(0, 10);
    const sourceId    = `upstream:${stationCode}:${readingDate}`;
    const locationIds = slugs.flatMap((s) => {
      const id = locationIdBySlug.get(s);
      return id ? [id] : [];
    });

    await maybeUpsert(sourceId, spec, reading, locationIds);
  }

  return { ok: true, rowsWritten };
}

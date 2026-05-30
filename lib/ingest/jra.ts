/**
 * JRA water quality ingest — sub-goal 69 (corrected).
 *
 * Queries the public ArcGIS REST FeatureServer:
 *   https://services7.arcgis.com/.../River_Watch_data_with_station_locations/FeatureServer/0/
 *
 * BUG FIX (2026-05-25): the original implementation filtered by StationName
 * which is NULL on every 2026 JRA record, silently dropping all current data.
 * The stable identifier is the `name` short code (J08, J10, J20, etc.).
 * WHERE clause now uses: name IN ('J08','J10','J20','J21','J22','J23','J24','J26','J41')
 * Sort is by `creationdate DESC` (not date_Time, which is also null on 2026 records).
 *
 * Collected-at fallback chain: date_Time → CollectionDate → creationdate → skip row.
 * Station-name fallback:       StationName → displayName lookup by code → raw code.
 */

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { RunResult } from './run';
import {
  getAllMappedStationCodes,
  getDisplayNameByCode,
} from '@/lib/data/station-mapping';
import { USER_AGENT } from './user-agent';

const ARCGIS_BASE =
  'https://services7.arcgis.com/9ZKA6C4VwqZYRSvM/arcgis/rest/services' +
  '/River_Watch_data_with_station_locations/FeatureServer/0/query';

const OUT_FIELDS = [
  'OBJECTID', 'GlobalID',
  'StationName', 'name', 'StationNumber', 'Organization',
  'Latitude', 'Longitude',
  'date_Time', 'CollectionDate', 'creationdate',   // all three in fallback chain
  'Ecoli', 'Enterococci', 'EcoliAverage', 'EnterococciAverage',
  'WaterTemperature', 'AirTemperature',
  'Conductivity', 'Turbidity', 'Salinity', 'SiteConditions',
].join(',');

// ── Zod schema ────────────────────────────────────────────────────────────────

const AttrSchema = z.object({
  GlobalID:            z.string(),
  // StationName is NULL on all 2026 records — must be nullable
  StationName:         z.string().nullable().optional(),
  name:                z.string().nullable().optional(),   // short code e.g. "J23"
  // StationNumber is nullable
  StationNumber:       z.string().nullable().optional(),
  Organization:        z.string().nullable().optional(),
  Latitude:            z.number().nullable().optional(),
  Longitude:           z.number().nullable().optional(),
  // date_Time is NULL on all 2026 records — must be nullable
  date_Time:           z.string().nullable().optional(),
  // CollectionDate is NULL on all 2026 records — must be nullable
  CollectionDate:      z.string().nullable().optional(),
  // creationdate is epoch-ms; ArcGIS auto-field, always populated
  creationdate:        z.number().nullable().optional(),
  Ecoli:               z.number().nullable().optional(),
  Enterococci:         z.number().nullable().optional(),
  EcoliAverage:        z.number().nullable().optional(),
  EnterococciAverage:  z.number().nullable().optional(),
  WaterTemperature:    z.number().nullable().optional(),   // °C — converted to °F on insert
  AirTemperature:      z.number().nullable().optional(),   // °C
  Conductivity:        z.number().nullable().optional(),
  Turbidity:           z.number().nullable().optional(),
  Salinity:            z.number().nullable().optional(),
  SiteConditions:      z.string().nullable().optional(),
});

const ArcGisResponseSchema = z.object({
  features: z.array(z.object({ attributes: AttrSchema })),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function cToF(celsius: number | null | undefined): number | null {
  if (celsius == null) return null;
  return Math.round((celsius * 9 / 5 + 32) * 10) / 10;
}

/**
 * Sanitize a JRA measurement value.
 * JRA uses −9 as a sentinel for "no reading taken" (instrument not deployed,
 * sample lost, QA rejection, etc.). Treat any negative value as null.
 */
function sanitize(v: number | null | undefined): number | null {
  if (v == null || v < 0) return null;
  return v;
}

/**
 * Resolve sample collection timestamp via fallback chain:
 *   1. date_Time  — ISO-like string (present on older records)
 *   2. CollectionDate — "M/D/YYYY" string (present on named stations, older records)
 *   3. creationdate — epoch-ms, ArcGIS auto-managed; populated on ALL records
 *
 * Returns null only if all three are absent (skip the row).
 */
function parseCollectedAt(a: z.infer<typeof AttrSchema>): Date | null {
  for (const raw of [a.date_Time, a.CollectionDate]) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  if (a.creationdate != null) {
    const d = new Date(a.creationdate);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Resolve the display name for a reading:
 *   1. StationName field (populated on older records)
 *   2. displayName lookup by `name` code (covers 2026 records where StationName is null)
 *   3. Raw `name` code as last resort
 */
function resolveStationName(
  rawStationName: string | null | undefined,
  code: string | null | undefined,
): string {
  if (rawStationName) return rawStationName;
  if (code) return getDisplayNameByCode(code);
  return 'Unknown';
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runJraIngestion(): Promise<RunResult> {
  const supabase = await createServerClient('service');

  // Build WHERE clause from station codes only — StationName is unreliable.
  // Include all primary + upstream-watch stations so advisory derivation
  // (sub-goal 70) has complete data.
  const codes = getAllMappedStationCodes();

  if (!codes.length) {
    return {
      ok: false, rowsWritten: 0,
      error: 'No station codes in mapping — cannot build WHERE clause',
    };
  }

  const where = `name IN (${codes.map((c) => `'${c}'`).join(',')})`;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const params = new URLSearchParams({
    f:                 'json',
    where,
    outFields:         OUT_FIELDS,
    returnGeometry:    'false',
    // Sort by creationdate DESC so 2026 records with null date_Time surface first.
    orderByFields:     'creationdate DESC',
    resultRecordCount: '2000',  // ~9 stations × multi-year history
  });

  const resp = await fetch(`${ARCGIS_BASE}?${params}`, {
    headers: {
      Accept:       'application/json',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    return { ok: false, rowsWritten: 0, error: `ArcGIS HTTP ${resp.status}` };
  }

  const json = await resp.json() as unknown;
  const parsed = ArcGisResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      rowsWritten: 0,
      error: `ArcGIS parse error: ${parsed.error.message.slice(0, 300)}`,
    };
  }

  const { features } = parsed.data;
  if (!features.length) {
    return { ok: true, rowsWritten: 0 };
  }

  // ── Build upsert rows ─────────────────────────────────────────────────────
  const rows: Array<{
    station_name:              string;
    station_code:              string | null;
    station_global_id:         string;
    organization:              string | null;
    latitude:                  number | null;
    longitude:                 number | null;
    collected_at:              string;
    ecoli_cfu_per_100ml:       number | null;
    enterococci_cfu_per_100ml: number | null;
    ecoli_average:             number | null;
    enterococci_average:       number | null;
    water_temp_f:              number | null;
    air_temp_f:                number | null;
    conductivity:              number | null;
    turbidity:                 number | null;
    salinity:                  number | null;
    site_conditions:           string | null;
    raw_payload:               Json;
  }> = [];

  for (const { attributes: a } of features) {
    const collectedAt = parseCollectedAt(a);
    if (!collectedAt) continue; // skip records with no parseable timestamp

    rows.push({
      station_name:              resolveStationName(a.StationName, a.name),
      station_code:              a.name ?? null,
      station_global_id:         a.GlobalID,
      organization:              a.Organization ?? null,
      latitude:                  a.Latitude ?? null,
      longitude:                 a.Longitude ?? null,
      collected_at:              collectedAt.toISOString(),
      ecoli_cfu_per_100ml:       sanitize(a.Ecoli),
      enterococci_cfu_per_100ml: sanitize(a.Enterococci),
      ecoli_average:             sanitize(a.EcoliAverage),
      enterococci_average:       sanitize(a.EnterococciAverage),
      water_temp_f:              cToF(a.WaterTemperature),
      air_temp_f:                cToF(a.AirTemperature),
      conductivity:              sanitize(a.Conductivity),
      turbidity:                 sanitize(a.Turbidity),
      salinity:                  sanitize(a.Salinity),
      site_conditions:           a.SiteConditions ?? null,
      raw_payload:               a as unknown as Json,
    });
  }

  if (!rows.length) {
    return { ok: true, rowsWritten: 0 };
  }

  // Upsert by station_global_id — idempotent; re-running same day adds 0 rows
  const { error } = await supabase
    .from('water_quality_readings')
    .upsert(rows, { onConflict: 'station_global_id', ignoreDuplicates: true });

  if (error) return { ok: false, rowsWritten: 0, error: error.message };

  return { ok: true, rowsWritten: rows.length };
}

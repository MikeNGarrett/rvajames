/**
 * JRA water quality ingest — sub-goal 69.
 *
 * Replaces the old cheerio scrape of thejamesriver.org with a direct query
 * against the public ArcGIS REST FeatureServer:
 *
 *   https://services7.arcgis.com/.../River_Watch_data_with_station_locations/FeatureServer/0/
 *
 * The FeatureServer exposes E. coli, Enterococci, water temperature, and other
 * indicators from James River Watch (JRA) volunteer monitoring.
 *
 * Design choices:
 *   - Fetches only the stations mapped in lib/data/station-mapping.ts.
 *   - Named stations (StationName IS NOT NULL) are filtered by StationName IN (...).
 *   - Chapel Island / J41 has null StationName — filtered by name = 'J41'.
 *   - J41 records also have null CollectionDate; falls back to the creationdate
 *     (epoch-ms) field for the sample timestamp.
 *   - Upserts by station_global_id — re-running same day produces 0 new rows.
 *   - Polite identification via User-Agent header.
 *   - Advisory derivation (sub-goal 70) is a separate step called after this one.
 */

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { RunResult } from './run';
import {
  getAllMappedStationNames,
  getAllMappedStationCodes,
  JRA_RICHMOND_STATIONS,
  type JraStation,
} from '@/lib/data/station-mapping';

const ARCGIS_BASE =
  'https://services7.arcgis.com/9ZKA6C4VwqZYRSvM/arcgis/rest/services' +
  '/River_Watch_data_with_station_locations/FeatureServer/0/query';

const OUT_FIELDS = [
  'OBJECTID', 'GlobalID',
  'StationName', 'name', 'StationNumber', 'Organization',
  'Latitude', 'Longitude',
  'date_Time', 'CollectionDate', 'creationdate',
  'Ecoli', 'Enterococci', 'EcoliAverage', 'EnterococciAverage',
  'WaterTemperature', 'AirTemperature',
  'Conductivity', 'Turbidity', 'Salinity', 'SiteConditions',
].join(',');

// ── Zod schema ────────────────────────────────────────────────────────────────

const AttrSchema = z.object({
  GlobalID:            z.string(),
  StationName:         z.string().nullish(),
  name:                z.string().nullish(),          // short code e.g. "J41"
  StationNumber:       z.string().nullish(),
  Organization:        z.string().nullish(),
  Latitude:            z.number().nullish(),
  Longitude:           z.number().nullish(),
  date_Time:           z.string().nullish(),
  CollectionDate:      z.string().nullish(),          // "M/D/YYYY" for named stations
  creationdate:        z.number().nullish(),           // epoch-ms; only J41 uses this
  Ecoli:               z.number().nullish(),
  Enterococci:         z.number().nullish(),
  EcoliAverage:        z.number().nullish(),
  EnterococciAverage:  z.number().nullish(),
  WaterTemperature:    z.number().nullish(),           // °C — converted to °F on insert
  AirTemperature:      z.number().nullish(),           // °C
  Conductivity:        z.number().nullish(),
  Turbidity:           z.number().nullish(),
  Salinity:            z.number().nullish(),
  SiteConditions:      z.string().nullish(),
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
 * The JRA dataset uses −9 as a sentinel for "no reading taken" (instrumentation
 * not deployed, sample lost, QA rejection, etc.). Treat any negative value as
 * null rather than storing a bogus reading.
 */
function sanitize(v: number | null | undefined): number | null {
  if (v == null || v < 0) return null;
  return v;
}

/**
 * Resolve sample collection timestamp.
 *
 * Priority:
 *   1. date_Time  — ISO-like string (rare; kept for forward-compat)
 *   2. CollectionDate — "M/D/YYYY" string used by named stations
 *   3. creationdate — epoch-ms used by J41 / Chapel Island
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

/** Build the display name for a reading, normalizing the API's raw StationName. */
function resolveDisplayName(
  rawApiName: string | null | undefined,
  code: string | null | undefined,
  byApiName: Record<string, string>,
  byCode: Record<string, string>,
): string {
  if (rawApiName && byApiName[rawApiName]) return byApiName[rawApiName];
  if (code && byCode[code]) return byCode[code];
  return rawApiName ?? code ?? 'Unknown';
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runJraIngestion(): Promise<RunResult> {
  const supabase = await createServerClient('service');

  // Build station lookup tables (apiName → displayName, code → displayName)
  const byApiName: Record<string, string> = {};
  const byCode: Record<string, string> = {};
  for (const s of Object.values(JRA_RICHMOND_STATIONS) as JraStation[]) {
    if (s.apiName) byApiName[s.apiName] = s.name;
    if (s.stationCode) byCode[s.stationCode] = s.name;
  }

  // ── Build ArcGIS WHERE clause ─────────────────────────────────────────────
  const stationNames = getAllMappedStationNames();
  const stationCodes = getAllMappedStationCodes();

  const namePart = stationNames.length
    ? `StationName IN (${stationNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')})`
    : '';
  const codePart = stationCodes.length
    ? `name IN (${stationCodes.map((c) => `'${c}'`).join(',')})`
    : '';
  const where = [namePart, codePart].filter(Boolean).join(' OR ');

  if (!where) {
    return { ok: false, rowsWritten: 0, error: 'No stations in mapping — cannot build WHERE clause' };
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const params = new URLSearchParams({
    f:                  'json',
    where,
    outFields:          OUT_FIELDS,
    returnGeometry:     'false',
    resultRecordCount:  '1000',
    // No orderByFields — sort client-side after date parsing (avoids NULL sort issues)
  });

  const resp = await fetch(`${ARCGIS_BASE}?${params}`, {
    headers: {
      Accept:       'application/json',
      'User-Agent': 'rva-james (mike.garrett@teamcolab.com)',
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
    if (!collectedAt) continue; // skip records with no parseable date

    rows.push({
      station_name:              resolveDisplayName(a.StationName, a.name, byApiName, byCode),
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

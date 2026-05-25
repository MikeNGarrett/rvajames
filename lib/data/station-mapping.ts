/**
 * Water quality station-to-access-point mapping.
 *
 * Maps each RVA James access point to the nearest James River Watch (JRA)
 * ArcGIS sampling station. Sub-goal 68 rationale and great-circle distances
 * are in docs/water-quality-station-mapping.md.
 *
 * IMPORTANT: The stable identifier for each station is the ArcGIS `name`
 * short code (e.g. "J23"), NOT the `StationName` string. As of the 2026
 * season JRA records have `StationName: null` on every feature — filtering by
 * StationName silently drops all current data. Always use `code` (the `name`
 * field) for WHERE clauses and dedup keys.
 *
 * Consumed by:
 *   - lib/ingest/jra.ts        (sub-goal 69) — ArcGIS WHERE clause + name fallback
 *   - lib/queries/water-quality.ts (sub-goal 69) — lookup readings per access point
 *   - components/water-quality-panel.tsx (sub-goal 71) — display
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JraStation {
  /**
   * Short station code from ArcGIS `name` field — the stable primary
   * identifier. StationName is unreliable (null on all 2026 records).
   */
  code: string;
  /**
   * Human-readable station name for UI display and as the `station_name`
   * DB column fallback when `StationName` is null on a feature record.
   */
  displayName: string;
  /**
   * Which bacteria indicators are tested at this station.
   *
   * Verification source: empirical query run 2026-05-25 against
   * water_quality_readings (174 rows, 9 stations, full ArcGIS history):
   *
   *   SELECT station_code,
   *          count(*) FILTER (WHERE ecoli_cfu_per_100ml IS NOT NULL) AS ecoli_n,
   *          count(*) FILTER (WHERE enterococci_cfu_per_100ml IS NOT NULL) AS entero_n
   *     FROM water_quality_readings GROUP BY station_code ORDER BY station_code;
   *
   * Result: entero_n = 0 for ALL 9 stations. JRA tests E. coli only at every
   * station in the Richmond reach. All stations are single-bacteria ['ecoli'].
   */
  bacteria: ReadonlyArray<'ecoli' | 'enterococcus'>;
  lat: number;
  lng: number;
  /** Collecting organization, e.g. "JRA". */
  organization: string;
}

export interface AccessPointStationConfig {
  /** Slug matching the `locations.slug` column. */
  slug: string;
  /**
   * Primary station(s) for this access point, ordered by priority.
   * The first station with a recent reading wins in query lookups.
   */
  primaryStations: JraStation[];
  /**
   * Upstream watch stations — a hit here is a 12–24h leading indicator
   * for downstream access points. Sub-goal 70 uses these for low-severity
   * "Upstream watch" advisories rather than full alerts at the downstream point.
   */
  upstreamWatchStations?: JraStation[];
  /** Distance in miles from access point to the primary station (great-circle). */
  distanceMi: number;
  /** Short rationale for this assignment. */
  notes: string;
}

// ── Stations (west → east, by approximate longitude) ─────────────────────────

/**
 * All 9 JRA stations mapped by this app, keyed by their ArcGIS `name` code.
 *
 * Corrected mapping confirmed from sub-goal 68 diagnostic (great-circle
 * distances) + user review. Coordinates from ArcGIS FeatureServer attribute
 * data; verified against the 2026 OBJECTID samples.
 */
export const JRA_STATIONS: Record<string, JraStation> = {
  /** J26 Robious Landing Park — westernmost station, ~10+ mi upstream of downtown */
  J26: {
    code:        'J26',
    displayName: 'Robious Landing Park',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5592,
    lng:         -77.6467,
    organization: 'JRA',
  },

  /** J24 Huguenot Flatwater — upstream watch for downtown stations */
  J24: {
    code:        'J24',
    displayName: 'Huguenot Flatwater',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5605,
    lng:         -77.5458,
    organization: 'JRA',
  },

  /** J23 Pony Pasture */
  J23: {
    code:        'J23',
    displayName: 'Pony Pasture',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5516,
    lng:         -77.5204,
    organization: 'JRA',
  },

  /** J22 James River 42nd Street Access */
  J22: {
    code:        'J22',
    displayName: 'James River 42nd Street Access',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5268,
    lng:         -77.4757,
    organization: 'JRA',
  },

  /** J21 Reedy Creek */
  J21: {
    code:        'J21',
    displayName: 'Reedy Creek',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5244,
    lng:         -77.4696,
    organization: 'JRA',
  },

  /** J20 Rope Swing at Tredegar */
  J20: {
    code:        'J20',
    displayName: 'Rope Swing at Tredegar',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5344,
    lng:         -77.4454,
    organization: 'JRA',
  },

  /** J10 14th Street */
  J10: {
    code:        'J10',
    displayName: '14th Street',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5309,
    lng:         -77.4319,
    organization: 'JRA',
  },

  /** J08 Rockett's Landing */
  J08: {
    code:        'J08',
    displayName: "Rockett's Landing",
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.5186,
    lng:         -77.4166,
    organization: 'JRA',
  },

  /**
   * J41 Chapel Island
   *
   * StationName and Organization are null in the FeatureServer; the record is
   * identified only by the short `name` code "J41". CollectionDate is also null
   * on 2026 records — use the `creationdate` (epoch-ms) field for the sample
   * timestamp. Coordinates from OBJECTID 3164 (May 2026 reading).
   * User (local Richmond expert) identifies this as the Chapel Island
   * sampling site near the Canal Walk.
   */
  J41: {
    code:        'J41',
    displayName: 'Chapel Island',
    bacteria:    ['ecoli'], // VERIFIED 2026-05-25: entero_n=0 across full history
    lat:         37.52541833,
    lng:         -77.42173598,
    organization: 'JRA',
  },
} satisfies Record<string, JraStation>;

// ── Access point → station mapping ───────────────────────────────────────────

const S = JRA_STATIONS;

/**
 * Full mapping of access-point slugs to their assigned JRA station(s).
 * Keyed by `locations.slug`. Corrected per plan spec + user review.
 *
 * J24 (Huguenot Flatwater) appears as upstreamWatchStation for several
 * downtown access points — a hit there is a 12–24h leading indicator.
 */
export const ACCESS_POINT_STATIONS: Record<string, AccessPointStationConfig> = {
  'pump-house': {
    slug: 'pump-house',
    primaryStations: [S.J26],
    distanceMi: 0.76,
    notes: 'Robious Landing Park (J26) is the nearest station. ~10+ mi upstream proxy ' +
           'is the best available for this western access point.',
  },

  'pony-pasture': {
    slug: 'pony-pasture',
    primaryStations: [S.J23],
    upstreamWatchStations: [S.J24],
    distanceMi: 0.82,
    notes: 'Pony Pasture (J23) — direct name/location match. J24 Huguenot Flatwater ' +
           'is upstream watch: a hit there is a 12–24h leading indicator.',
  },

  'texas-beach': {
    slug: 'texas-beach',
    primaryStations: [S.J22],
    upstreamWatchStations: [S.J24],
    distanceMi: 1.36,
    notes: 'James River 42nd Street Access (J22) is the nearest station for the ' +
           '42nd St corridor. J24 upstream watch applies.',
  },

  'buttermilk-trail': {
    slug: 'buttermilk-trail',
    primaryStations: [S.J21],
    distanceMi: 1.19,
    notes: 'Reedy Creek (J21) — user-confirmed. The Reedy Creek tributary confluence ' +
           'is the most representative station for the Buttermilk Trail entrance.',
  },

  'north-bank-trail': {
    slug: 'north-bank-trail',
    primaryStations: [S.J20],
    distanceMi: 0.73,
    notes: 'Rope Swing at Tredegar (J20) is the nearest station for the North Bank ' +
           'Trail corridor (40s–50s corridor).',
  },

  'belle-isle': {
    slug: 'belle-isle',
    primaryStations: [S.J20],
    upstreamWatchStations: [S.J24],
    distanceMi: 0.53,
    notes: 'Rope Swing at Tredegar (J20) — 0.53 mi, closest station. J24 upstream watch.',
  },

  'browns-island': {
    slug: 'browns-island',
    primaryStations: [S.J20],
    upstreamWatchStations: [S.J24],
    distanceMi: 0.25,
    notes: 'Rope Swing at Tredegar (J20) — 0.25 mi, adjacent to downtown rapids. ' +
           'J24 upstream watch.',
  },

  'mayo-island': {
    slug: 'mayo-island',
    primaryStations: [S.J10],
    upstreamWatchStations: [S.J08],
    distanceMi: 0.70,
    notes: '14th Street (J10) — user-confirmed (0.70 mi). J08 Rocketts Landing is ' +
           'listed as downstream watch; a hit there indicates water that just passed ' +
           'Mayo Island.',
  },

  'shiplock-trail': {
    slug: 'shiplock-trail',
    primaryStations: [S.J08],
    distanceMi: 1.06,
    notes: "Rocketts Landing (J08) — 1.06 mi, user-confirmed for the Shiplock/Canal " +
           "Walk corridor.",
  },

  'pipeline-trail': {
    slug: 'pipeline-trail',
    primaryStations: [S.J10, S.J41],
    distanceMi: 0.49,
    notes: '14th Street (J10) + Chapel Island (J41) both cover the Pipeline Trail ' +
           'corridor. Note: Pipeline Trail is permanently closed (DPU infrastructure ' +
           'since Sept 2024). Stations assigned for informational context only.',
  },
};

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns the station config for a given access-point slug, or null if
 * no station is mapped (e.g. USGS gauge slugs are not in this mapping).
 */
export function getStationConfig(
  slug: string,
): AccessPointStationConfig | null {
  return ACCESS_POINT_STATIONS[slug] ?? null;
}

/**
 * Returns the display name for a station code (e.g. 'J23' → 'Pony Pasture').
 * Falls back to the raw code if the code is unknown.
 * Used by jra.ts as the station_name fallback when StationName is null.
 */
export function getDisplayNameByCode(code: string): string {
  return JRA_STATIONS[code]?.displayName ?? code;
}

/**
 * Returns all unique station codes across all mapped access-point primary
 * stations, for use in the ArcGIS WHERE clause:
 *   name IN ('J08','J10',...)
 *
 * Includes upstream watch stations so their readings are also ingested
 * (needed for the sub-goal 70 advisory derivation).
 */
export function getAllMappedStationCodes(): string[] {
  const codes = new Set<string>();
  for (const config of Object.values(ACCESS_POINT_STATIONS)) {
    for (const s of config.primaryStations) codes.add(s.code);
    for (const s of config.upstreamWatchStations ?? []) codes.add(s.code);
  }
  return [...codes].sort();
}

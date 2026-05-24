/**
 * Water quality station-to-access-point mapping.
 *
 * Maps each of our 10 RVA James access points to the nearest James River Watch (JRA)
 * ArcGIS sampling station. Produced in sub-goal 68 by computing great-circle distances
 * from each access point's DB coordinates to every JRA station in the Richmond reach.
 *
 * See docs/water-quality-station-mapping.md for full rationale per mapping.
 *
 * Consumed by:
 *   - lib/ingest/jra.ts (sub-goal 69) — filter ArcGIS FeatureServer by bounding box,
 *     then match records to access points by station coordinates
 *   - lib/queries/water-quality.ts (sub-goal 69) — look up readings per access point
 *   - components/water-quality-panel.tsx (sub-goal 71) — display
 */

export interface JraStation {
  /** Normalized display name (plain apostrophe). */
  name: string;
  /**
   * Exact StationName string as returned by the ArcGIS FeatureServer.
   * Some entries use the Windows-1252 curly apostrophe (U+0092) rather than
   * a plain apostrophe — this field preserves the raw bytes for WHERE-clause use.
   * Empty string means StationName is null for this station — filter by stationCode
   * instead.
   */
  apiName: string;
  /**
   * Short station code from the `name` field (e.g. "J41"). Present for stations
   * where StationName is null. Used as the fallback identifier in WHERE clauses.
   */
  stationCode?: string;
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
   * Most access points have one; some may have two (e.g. reading both upriver
   * and downriver stations for a triangulated picture).
   */
  primaryStations: JraStation[];
  /** Distance in miles from access point to the primary station (great-circle). */
  distanceMi: number;
  /** Short rationale for this assignment. */
  notes: string;
}

// ── Richmond-reach JRA stations (west → east) ────────────────────────────────

/** All JRA stations in the Richmond reach used by this app. */
export const JRA_RICHMOND_STATIONS = {
  ponyPasture: {
    name: 'Pony Pasture',
    apiName: 'Pony Pasture',
    lat: 37.5516,
    lng: -77.5204,
    organization: 'JRA',
  },
  huguenotFlatwater: {
    name: 'Huguenot Flatwater',
    apiName: 'Huguenot Flatwater',
    lat: 37.5605,
    lng: -77.5458,
    organization: 'JRA',
  },
  james42ndStreet: {
    name: 'James River 42nd Street Access',
    apiName: 'James River 42nd Street Access',
    lat: 37.5268,
    lng: -77.4757,
    organization: 'JRA',
  },
  reedyCreek: {
    name: 'Reedy Creek',
    apiName: 'Reedy Creek',
    lat: 37.5244,
    lng: -77.4696,
    organization: 'JRA',
  },
  ropeSwingTredegar: {
    name: 'Rope Swing at Tredegar',
    apiName: 'Rope Swing at Tredegar',
    lat: 37.5344,
    lng: -77.4454,
    organization: 'JRA',
  },
  fourteenthStreet: {
    name: '14th Street',
    apiName: '14th Street',
    lat: 37.5309,
    lng: -77.4319,
    organization: 'JRA',
  },
  rockettsLanding: {
    /**
     * ArcGIS returns "Rocketts Landing" (Windows-1252 curly apostrophe U+0092).
     * The apiName field preserves the exact byte for WHERE-clause use.
     * The display name uses a plain apostrophe.
     */
    name: "Rockett's Landing",
    apiName: 'Rocketts Landing',
    lat: 37.5186,
    lng: -77.4166,
    organization: 'JRA',
  },
  robiousLanding: {
    name: 'Robious Landing Park',
    apiName: 'Robious Landing Park',
    lat: 37.5592,
    lng: -77.6467,
    organization: 'JRA',
  },
  /**
   * Chapel Island — ArcGIS station code J41.
   *
   * StationName and Organization are null in the FeatureServer; the record is
   * identified only by the short `name` code "J41". CollectionDate is also null —
   * use the `creationdate` (epoch-ms) field for the sample timestamp.
   *
   * Coordinates confirmed from OBJECTID 3164 (May 2026 reading). User (local
   * Richmond expert) identifies this sampling site as Chapel Island.
   */
  chapelIsland: {
    name: 'Chapel Island',
    apiName: '',          // StationName is null; query by stationCode 'J41' instead
    stationCode: 'J41',
    lat: 37.52541833,
    lng: -77.42173598,
    organization: 'JRA',
  },
} as const satisfies Record<string, JraStation>;

// ── Access point → station mapping ───────────────────────────────────────────

const S = JRA_RICHMOND_STATIONS;

/**
 * Full mapping of access-point slugs to their assigned JRA station(s).
 * Keyed by `locations.slug`.
 */
export const ACCESS_POINT_STATIONS: Record<string, AccessPointStationConfig> = {
  'pump-house': {
    slug: 'pump-house',
    primaryStations: [S.ponyPasture],
    distanceMi: 0.76,
    notes: 'Pony Pasture is the nearest station (0.76 mi upstream). Plan initially ' +
           'listed pump-house as having no nearby station; distance data shows it does.',
  },

  'pony-pasture': {
    slug: 'pony-pasture',
    primaryStations: [S.ponyPasture],
    distanceMi: 0.82,
    notes: 'Direct name match. The 0.82 mi offset is parking-lot vs. in-river coordinates.',
  },

  'texas-beach': {
    slug: 'texas-beach',
    primaryStations: [S.james42ndStreet],
    distanceMi: 1.36,
    notes: 'James River 42nd Street Access is both the closest station and the semantic ' +
           'match for the 42nd St corridor. Slight downstream proxy (water passes Texas ' +
           'Beach before reaching the 42nd St station).',
  },

  'buttermilk-trail': {
    slug: 'buttermilk-trail',
    primaryStations: [S.reedyCreek],
    distanceMi: 1.19,
    notes: 'User-confirmed: Reedy Creek. The Reedy Creek tributary confluence is the most ' +
           'representative station for the Buttermilk Trail entrance area.',
  },

  'north-bank-trail': {
    slug: 'north-bank-trail',
    primaryStations: [S.james42ndStreet],
    distanceMi: 0.73,
    notes: 'Plan suggested Rope Swing at Tredegar (1.37 mi). 42nd Street Access is ' +
           'nearly 2× closer (0.73 mi). North Bank Trail runs in the 40s–50s corridor.',
  },

  'belle-isle': {
    slug: 'belle-isle',
    primaryStations: [S.reedyCreek],
    distanceMi: 0.53,
    notes: 'User-confirmed: Reedy Creek (0.53 mi, closest station).',
  },

  'browns-island': {
    slug: 'browns-island',
    primaryStations: [S.ropeSwingTredegar],
    distanceMi: 0.25,
    notes: 'Rope Swing at Tredegar is 0.25 mi — adjacent to the downtown rapids complex. ' +
           'Matches the plan exactly.',
  },

  'mayo-island': {
    slug: 'mayo-island',
    primaryStations: [S.fourteenthStreet],
    distanceMi: 0.70,
    notes: 'User-confirmed: 14th Street (0.70 mi). Mayo Island is in the lower rapids ' +
           'near the 14th Street bridge area.',
  },

  'shiplock-trail': {
    slug: 'shiplock-trail',
    primaryStations: [S.chapelIsland],
    distanceMi: 1.06,
    notes: 'User-confirmed: Chapel Island (J41 station, 1.06 mi). StationName is null ' +
           'in ArcGIS — identified by station code J41. User knows this as the Chapel ' +
           'Island sampling site on the river near Canal Walk.',
  },

  'pipeline-trail': {
    slug: 'pipeline-trail',
    primaryStations: [S.fourteenthStreet],
    distanceMi: 0.49,
    notes: 'Closest station for this corridor. Note: Pipeline Trail is permanently closed ' +
           '(DPU wastewater infrastructure since Sept 2024). Station is assigned for ' +
           'informational context if bacteria data is requested for this location.',
  },
};

/**
 * Returns the station config for a given access-point slug, or null if no
 * station is mapped (e.g. USGS gauge slugs are not in this mapping).
 */
export function getStationConfig(slug: string): AccessPointStationConfig | null {
  return ACCESS_POINT_STATIONS[slug] ?? null;
}

/**
 * Returns the list of all unique JRA StationName values that the app cares about,
 * for use in ArcGIS WHERE clauses (filters out stations whose apiName is empty,
 * i.e. those identified by stationCode instead).
 */
export function getAllMappedStationNames(): string[] {
  const names = new Set<string>();
  for (const config of Object.values(ACCESS_POINT_STATIONS)) {
    for (const station of config.primaryStations) {
      if (station.apiName) names.add(station.apiName);
    }
  }
  return [...names];
}

/**
 * Returns the list of all unique station codes (from the `name` field) for
 * stations that have no StationName (i.e. identified by code only, e.g. J41).
 */
export function getAllMappedStationCodes(): string[] {
  const codes = new Set<string>();
  for (const config of Object.values(ACCESS_POINT_STATIONS)) {
    for (const station of config.primaryStations) {
      if (!station.apiName && station.stationCode) codes.add(station.stationCode);
    }
  }
  return [...codes];
}

/**
 * Water quality queries — sub-goal 69.
 *
 * Reads from the water_quality_readings table (written by lib/ingest/jra.ts)
 * and resolves the station → access-point mapping from lib/data/station-mapping.ts.
 */

import { createServerClient } from '@/lib/supabase/server';
import { ACCESS_POINT_STATIONS } from '@/lib/data/station-mapping';

export interface WaterQualityReading {
  /** Normalized station display name (e.g. "Pony Pasture"). */
  stationName: string;
  /** Short station code, if any (e.g. "J41"). */
  stationCode: string | null;
  /** Collecting organization (e.g. "JRA"). */
  organization: string | null;
  /** When the sample was collected. */
  collectedAt: Date;
  /** How many whole days ago the sample was collected. */
  daysOld: number;
  /** E. coli in CFU/100mL. VDH single-sample max: 235. */
  ecoliCfuPer100ml: number | null;
  /** Enterococci in CFU/100mL. VDH single-sample max: 104. */
  enterococciCfuPer100ml: number | null;
  /** Pre-computed running average from JRA. */
  ecoliAverage: number | null;
  /** Pre-computed running average from JRA. */
  enterococciAverage: number | null;
  /** Water temperature in °F (converted from Celsius on ingest). */
  waterTempF: number | null;
  /** Air temperature in °F. */
  airTempF: number | null;
  /** Volunteer's free-text site conditions note. */
  siteConditions: string | null;
}

/**
 * Returns the most recent water quality reading for an access-point slug,
 * or null if:
 *   - the slug has no mapped station (gauges, unmapped locations), or
 *   - no readings exist yet for the station.
 */
export async function getLatestWaterQualityReading(
  accessPointSlug: string,
): Promise<WaterQualityReading | null> {
  const config = ACCESS_POINT_STATIONS[accessPointSlug];
  if (!config) return null;

  const stationNames = config.primaryStations.map((s) => s.name);
  if (!stationNames.length) return null;

  const supabase = await createServerClient('service');

  const { data, error } = await supabase
    .from('water_quality_readings')
    .select('station_name,station_code,organization,collected_at,ecoli_cfu_per_100ml,enterococci_cfu_per_100ml,ecoli_average,enterococci_average,water_temp_f,air_temp_f,site_conditions')
    .in('station_name', stationNames)
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const collectedAt = new Date(data.collected_at);
  const daysOld = Math.floor(
    (Date.now() - collectedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    stationName:            data.station_name,
    stationCode:            data.station_code,
    organization:           data.organization,
    collectedAt,
    daysOld,
    ecoliCfuPer100ml:       data.ecoli_cfu_per_100ml,
    enterococciCfuPer100ml: data.enterococci_cfu_per_100ml,
    ecoliAverage:           data.ecoli_average,
    enterococciAverage:     data.enterococci_average,
    waterTempF:             data.water_temp_f,
    airTempF:               data.air_temp_f,
    siteConditions:         data.site_conditions,
  };
}

/**
 * Returns readings for all access points with data, keyed by slug.
 * Used by the homepage and the AI prompt builder to load all locations in one pass.
 */
export async function getAllLatestWaterQualityReadings(): Promise<
  Record<string, WaterQualityReading>
> {
  // Collect all unique station names across all configured access points
  const allStationNames = new Set<string>();
  for (const config of Object.values(ACCESS_POINT_STATIONS)) {
    for (const s of config.primaryStations) {
      allStationNames.add(s.name);
    }
  }
  if (!allStationNames.size) return {};

  const supabase = await createServerClient('service');

  // Fetch the latest reading per station in one query using a window function approach:
  // since Supabase/PostgREST doesn't support DISTINCT ON directly, we fetch all rows
  // ordered by (station_name, collected_at DESC) and deduplicate in JS.
  const { data, error } = await supabase
    .from('water_quality_readings')
    .select('station_name,station_code,organization,collected_at,ecoli_cfu_per_100ml,enterococci_cfu_per_100ml,ecoli_average,enterococci_average,water_temp_f,air_temp_f,site_conditions')
    .in('station_name', [...allStationNames])
    .order('collected_at', { ascending: false })
    .limit(200); // max ~10 stations × ~20 recent readings each

  if (error || !data) return {};

  // Keep first (most recent) row per station name
  const latestPerStation = new Map<string, typeof data[number]>();
  for (const row of data) {
    if (!latestPerStation.has(row.station_name)) {
      latestPerStation.set(row.station_name, row);
    }
  }

  // Map each access point to its reading
  const result: Record<string, WaterQualityReading> = {};
  for (const [slug, config] of Object.entries(ACCESS_POINT_STATIONS)) {
    for (const station of config.primaryStations) {
      const row = latestPerStation.get(station.name);
      if (!row) continue;

      const collectedAt = new Date(row.collected_at);
      const daysOld = Math.floor(
        (Date.now() - collectedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      result[slug] = {
        stationName:            row.station_name,
        stationCode:            row.station_code,
        organization:           row.organization,
        collectedAt,
        daysOld,
        ecoliCfuPer100ml:       row.ecoli_cfu_per_100ml,
        enterococciCfuPer100ml: row.enterococci_cfu_per_100ml,
        ecoliAverage:           row.ecoli_average,
        enterococciAverage:     row.enterococci_average,
        waterTempF:             row.water_temp_f,
        airTempF:               row.air_temp_f,
        siteConditions:         row.site_conditions,
      };
      break; // first primary station with data wins
    }
  }

  return result;
}

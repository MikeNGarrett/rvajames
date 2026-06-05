/**
 * Server-side resolver for the Richmond Conditions section — sub-goal 90.
 *
 * Composes the deterministic data slice the <RichmondConditionsSection>
 * component renders. All inputs come from already-ingested sources:
 *   - NWS hourly forecast → conditions_snapshots[source='nws_hourly'].payload
 *     (periods + open_meteo_hourly array)
 *   - USGS upriver gauge → metroState.upriver (gage_ft, water_temp_f)
 *   - Advisories + CSO state → computeCsoState() + active advisory rows
 *   - Closures → active_statuses with kind='closed' or 'closed_indefinite'
 *
 * The component takes the result as a prop; this resolver runs server-side
 * in the page render. No client-side AI involvement here — the rules
 * engine + computed apparent-temp/wet-bulb give us a complete answer.
 *
 * Failure mode: returns sensible defaults when data is missing rather than
 * throwing. Null waterTempF/uv/etc. are handled by the rules engine and the
 * UI component; the section ALWAYS renders.
 */

import { createServerClient } from '@/lib/supabase/server';
import { computeCsoState } from './today';
import type { MetroRiverState } from './river-segment';
import {
  swimToday,
  happinessIndex,
  nextHoursOutlook,
  headlineForRichmondConditions,
  type HourlyForecast,
} from '@/lib/safety/rules';
import { apparentTemperatureF } from '@/lib/utils/apparent-temp';
import { wetBulbF, heatStressZone, type HeatStressZone } from '@/lib/utils/wet-bulb';
import type { RichmondConditionsData } from '@/components/richmond/RichmondConditionsSection';

/** Shape of one Open-Meteo hour as persisted in the snapshot payload. */
interface OpenMeteoHour {
  time:        string;
  uv:          number | null;
  humidityPct: number | null;
  windMph:     number | null;
  precipPct:   number | null;
  ambientF:    number | null;
}

/** Shape of one NWS hourly period as persisted in the snapshot payload. */
interface NwsPeriod {
  startTime:     string;
  temperature:   number;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
}

/** Flood-stage gage value (ft) per NWS published threshold for 02037500. */
const FLOOD_STAGE_FT = 10;

/**
 * Reads the latest NWS+Open-Meteo snapshot, builds the rules-engine inputs,
 * and runs the four deterministic rules to produce the section's full data
 * slice. Caller passes `metroState` (already fetched for the river panel)
 * to avoid a redundant USGS round-trip.
 */
export async function getRichmondConditionsData(
  date: string,
  metroState: MetroRiverState,
): Promise<RichmondConditionsData> {
  const supabase = await createServerClient('anon');

  // ── 1. Latest NWS hourly snapshot (includes open_meteo_hourly) ────────────
  const { data: snapshot } = await supabase
    .from('conditions_snapshots')
    .select('payload, fetched_at')
    .eq('source', 'nws_hourly')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = (snapshot?.payload ?? {}) as {
    periods?:           NwsPeriod[];
    open_meteo_hourly?: OpenMeteoHour[] | null;
  };
  const periods  = payload.periods ?? [];
  const omHours  = payload.open_meteo_hourly ?? [];

  // ── 2. CSO + advisory state ───────────────────────────────────────────────
  const cso = await computeCsoState(date);
  const csoActive48h =
    cso.activelyDischarging.count > 0 || cso.advisoriesOnSelectedDate.count > 0;

  const { data: advisoriesRows } = await supabase
    .from('advisories')
    .select('kind, severity')
    .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`);
  const advisories = advisoriesRows ?? [];

  const bacterialAdvisoryActive = advisories.some(
    (a) => a.kind === 'water_quality',
  );
  const SEVERITY_ORDER = ['extreme', 'high', 'moderate', 'low'] as const;
  type Severity = (typeof SEVERITY_ORDER)[number];
  const maxSeverity: Severity | 'none' =
    SEVERITY_ORDER.find((s) => advisories.some((a) => a.severity === s)) ?? 'none';

  // ── 3. Closures at top river locations ────────────────────────────────────
  // Curated subset — these are the marquee family destinations whose status
  // most affects the headline "great day to head out" framing. Not "all
  // published locations" by design — a closure at, say, Dock Street Park
  // shouldn't drag the metro-wide signal. Added huguenot-flatwater 2026-06-05
  // (migration 0017+): JRA-tested swim + family-friendly calm-water put-in
  // upstream of the rapids.
  const TOP_LOCATIONS = [
    'belle-isle', 'pony-pasture', 'texas-beach',
    'browns-island', 'mayo-island', 'pump-house',
    'huguenot-flatwater',
  ];
  const { data: locationRows } = await supabase
    .from('locations')
    .select('id, slug')
    .in('slug', TOP_LOCATIONS);
  const topIds = (locationRows ?? []).map((l) => l.id);

  let closuresAtTopLocations = 0;
  if (topIds.length > 0) {
    const { count } = await supabase
      .from('location_status')
      .select('*', { count: 'exact', head: true })
      .in('location_id', topIds)
      .in('kind', ['closed', 'closed_indefinite'])
      .lte('effective_from', new Date().toISOString())
      .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`);
    closuresAtTopLocations = count ?? 0;
  }

  // ── 4. Compute apparent-temp + wet-bulb from current hour ─────────────────
  const upriver = metroState.upriver;
  const currentHour: OpenMeteoHour | undefined = omHours[0];
  const ambientF  = currentHour?.ambientF ?? periods[0]?.temperature ?? null;
  const humidity  = currentHour?.humidityPct ?? null;
  const windMph   = currentHour?.windMph ?? 0;
  const uvNow     = currentHour?.uv ?? null;

  // Falls back to ambient when we lack humidity/wind — better than NaN.
  const apparentTempF =
    ambientF !== null && humidity !== null
      ? apparentTemperatureF(ambientF, humidity, windMph ?? 0)
      : ambientF ?? 75; // last-ditch fallback so the score still computes
  const wetBulbValueF =
    ambientF !== null && humidity !== null ? wetBulbF(ambientF, humidity) : (ambientF ?? 70) - 5;
  const heatZone: HeatStressZone = heatStressZone(wetBulbValueF);

  // ── 5. Build HourlyForecast[] for nextHoursOutlook (next 4h) ──────────────
  // Join NWS periods + Open-Meteo by index. Both arrays are anchored to
  // "next 24h from cron-fetch time" so position-i values represent the
  // same calendar hour. NWS provides shortForecast + ambientF; Open-Meteo
  // provides humidity + wind for apparent-temp computation.
  const hourly: HourlyForecast[] = periods.slice(0, 4).map((p, i) => {
    const om = omHours[i];
    const hH = om?.humidityPct ?? humidity ?? 50;
    const hW = om?.windMph ?? windMph ?? 0;
    return {
      startTimeIso:    p.startTime,
      ambientF:        p.temperature,
      apparentF:       apparentTemperatureF(p.temperature, hH, hW),
      precipChancePct: p.probabilityOfPrecipitation?.value ?? om?.precipPct ?? 0,
      shortForecast:   p.shortForecast,
    };
  });
  const outlook = nextHoursOutlook(hourly, 4);

  // Sparkline for the FeelsLikeTile — apparent-temp series across the
  // 4h window. Time values are unix ms for the existing <Sparkline>
  // primitive.
  const feelsLikeSparkPoints = hourly.map((h) => ({
    t: new Date(h.startTimeIso).getTime(),
    v: h.apparentF,
  }));

  // ── 6. Run the rules engine ───────────────────────────────────────────────
  const waterTempF  = upriver.waterTempF;
  const floodStage  = (upriver.gageFt ?? 0) >= FLOOD_STAGE_FT;
  const swim = swimToday({
    waterTempF,
    bacterialAdvisoryActive,
    csoActive48h,
    floodStage,
  });

  const happiness = happinessIndex({
    waterTempF,
    apparentTempF,
    wetBulbF: wetBulbValueF,
    precip4hChance: outlook.precipitationChance,
    uv: uvNow ?? 5,                  // 5 = moderate fallback when null
    advisorySeverity: maxSeverity,
    closuresAtTopLocations,
  });

  const headline = headlineForRichmondConditions(happiness.band, swim.status, heatZone);

  // ── 7. Water quality status — quick read from existing helper data ────────
  // For sub-goal 90 we surface only the deterministic "safe / caution / null"
  // signal from the most recent water_quality_readings row if present. The
  // detailed JRA panel on /locations/[slug] already shows the full reading.
  const { data: wqRow } = await supabase
    .from('water_quality_readings')
    .select('ecoli_cfu_per_100ml, enterococci_cfu_per_100ml, collected_at')
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let waterQualityStatus: 'safe' | 'caution' | null = null;
  if (wqRow) {
    const ageDays = wqRow.collected_at
      ? Math.floor(
          (Date.now() - new Date(wqRow.collected_at).getTime()) / 86_400_000,
        )
      : 999;
    if (ageDays <= 14) {
      const ecoli = wqRow.ecoli_cfu_per_100ml ?? 0;
      const ent   = wqRow.enterococci_cfu_per_100ml ?? 0;
      waterQualityStatus = ecoli >= 235 || ent >= 104 ? 'caution' : 'safe';
    }
  }

  return {
    headline,
    swim,
    happiness,
    apparentTempF,
    heatZone,
    outlook,
    waterTempF,
    waterQualityStatus,
    uv:                   uvNow,
    feelsLikeSparkPoints: feelsLikeSparkPoints.length >= 2 ? feelsLikeSparkPoints : undefined,
  };
}

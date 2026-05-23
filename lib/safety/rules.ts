/**
 * Deterministic safety rules engine.
 * Pure functions — no I/O, no AI, no side effects.
 * Single source of truth alongside lib/safety/thresholds.json.
 */

import thresholds from './thresholds.json';

export type SafetyStatus = 'safe' | 'caution' | 'danger';

/** Worst-of helper: danger > caution > safe */
function worst(a: SafetyStatus, b: SafetyStatus): SafetyStatus {
  if (a === 'danger' || b === 'danger') return 'danger';
  if (a === 'caution' || b === 'caution') return 'caution';
  return 'safe';
}

// ─── Individual rule functions ────────────────────────────────────────────────

/**
 * Converts a gage height to a metro-level status.
 * All thresholds key to USGS 02037500 (Westham upriver gauge).
 * Returns null if gageFt is null (no data available).
 */
export function gageHeightStatus(gageFt: number | null): SafetyStatus | 'unknown' {
  if (gageFt === null) return 'unknown';
  if (gageFt > thresholds.gage.high_max_ft) return 'danger';
  if (gageFt > thresholds.gage.elevated_max_ft) return 'caution';
  if (gageFt > thresholds.gage.normal_max_ft) return 'caution';
  return 'safe';
}

/**
 * Status based on rainfall in the last 24–48h.
 * Any rain above the trigger threshold → swim hold for 48h.
 */
export function postRainSwimStatus(rain48hIn: number | null | undefined): SafetyStatus {
  if (rain48hIn == null) return 'safe'; // no data = assume no rain
  return rain48hIn >= thresholds.swim.post_rain_trigger_in_24h ? 'caution' : 'safe';
}

/**
 * Status based on active CSO advisories.
 * Any active CSO advisory → swimming danger at all locations.
 */
export function csoAdvisoryStatus(
  advisories: Array<{ kind: string }>,
): SafetyStatus {
  const hasCSO = advisories.some((a) => a.kind === 'cso_overflow');
  return hasCSO ? 'danger' : 'safe';
}

/**
 * Status based on E. coli bacteria count (CFU/100 mL).
 */
export function bacterialStatus(
  latestCfu: number | null,
): SafetyStatus | 'unknown' {
  if (latestCfu === null) return 'unknown';
  if (latestCfu >= thresholds.swim.ecoli_unsafe_cfu_per_100ml) return 'danger';
  if (latestCfu >= thresholds.swim.ecoli_max_cfu_per_100ml) return 'caution';
  return 'safe';
}

/**
 * Status based on water temperature.
 */
export function waterTempStatus(waterTempF: number | null): SafetyStatus | 'unknown' {
  if (waterTempF === null) return 'unknown';
  if (waterTempF < thresholds.swim.cold_water_no_swim_f) return 'danger';
  if (waterTempF < thresholds.swim.cold_water_caution_f) return 'caution';
  return 'safe';
}

// ─── Combined status ──────────────────────────────────────────────────────────

export interface CombinedStatus {
  status: SafetyStatus;
  /** Short human-readable explanation of the dominant rule that set the status */
  reason: string;
  /** 2–5 word label for the pill, e.g. "Normal flow" */
  label: string;
}

export interface MetroStateInput {
  gageFt: number | null;
  waterTempF?: number | null;
  precip48hIn?: number | null;
}

/**
 * Combines all rules and returns the worst status plus a human-readable reason.
 * Used by LocationCard to produce a deterministic status pill without AI.
 */
export function combinedLocationStatus(
  metro: MetroStateInput,
  advisories: Array<{ kind: string; severity: string; headline: string }>,
  locationSlug: string,
): CombinedStatus {
  const loc = thresholds.locations[locationSlug as keyof typeof thresholds.locations];

  // 1. Gage height (primary signal)
  const gageStatus = gageHeightStatus(metro.gageFt);
  let status: SafetyStatus = gageStatus === 'unknown' ? 'caution' : gageStatus;
  let reason = metro.gageFt === null
    ? 'No gage data — check conditions before visiting'
    : metro.gageFt > thresholds.gage.high_max_ft
      ? `Gage ${metro.gageFt} ft — above ${thresholds.gage.high_max_ft} ft high threshold`
      : metro.gageFt > thresholds.gage.elevated_max_ft
        ? `Gage ${metro.gageFt} ft — above ${thresholds.gage.elevated_max_ft} ft elevated threshold`
        : metro.gageFt > thresholds.gage.normal_max_ft
          ? `Gage ${metro.gageFt} ft — slightly elevated, use caution`
          : `Gage ${metro.gageFt} ft — normal range`;

  // 2. Flood closure (location-specific)
  if (
    metro.gageFt !== null &&
    loc &&
    'flood_close_ft' in loc &&
    typeof loc.flood_close_ft === 'number' &&
    metro.gageFt >= loc.flood_close_ft
  ) {
    status = 'danger';
    reason = `Gage ${metro.gageFt} ft — ${loc.flood_close_ft} ft closes this location`;
  }

  // 3. High-severity advisory overrides to danger
  const hasSevereAdvisory = advisories.some(
    (a) => a.severity === 'high' || a.severity === 'extreme',
  );
  if (hasSevereAdvisory) {
    status = 'danger';
    const adv = advisories.find((a) => a.severity === 'high' || a.severity === 'extreme');
    reason = adv ? adv.headline : 'Active high-severity advisory';
  }

  // 4. CSO advisory
  const csoStatus = csoAdvisoryStatus(advisories);
  status = worst(status, csoStatus);
  if (csoStatus === 'danger') {
    reason = 'Active CSO overflow advisory — no swimming for 48 h';
  }

  // 5. Post-rain swim hold
  const rainStatus = postRainSwimStatus(metro.precip48hIn);
  status = worst(status, rainStatus);
  if (rainStatus === 'caution' && status === 'caution') {
    reason = `${(metro.precip48hIn ?? 0).toFixed(1)}" recent rain — 48 h swim hold`;
  }

  // 6. Water temperature
  if (metro.waterTempF !== undefined && metro.waterTempF !== null) {
    const tempStatus = waterTempStatus(metro.waterTempF);
    if (tempStatus !== 'unknown') {
      status = worst(status, tempStatus);
      if (tempStatus === 'danger' && metro.waterTempF < thresholds.swim.cold_water_no_swim_f) {
        reason = `Water ${metro.waterTempF}°F — cold shock risk, no swimming`;
      }
    }
  }

  // Derive pill label from final status + gage
  const label =
    status === 'danger'
      ? metro.gageFt !== null && metro.gageFt > thresholds.gage.high_max_ft
        ? 'High water'
        : 'Check advisories'
      : status === 'caution'
        ? metro.gageFt !== null && metro.gageFt > thresholds.gage.normal_max_ft
          ? 'Elevated flow'
          : 'Use caution'
        : 'Good conditions';

  return { status, reason, label };
}

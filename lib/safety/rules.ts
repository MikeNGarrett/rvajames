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

// ─── Rapids class ────────────────────────────────────────────────────────────

export type RapidsClassValue = 'I-II' | 'II-III' | 'III-IV' | 'IV-V';

export interface RapidsClassResult {
  class:  RapidsClassValue;
  label:  string;
}

/**
 * Returns the whitewater rapids class for the Richmond urban reach
 * based on the upriver USGS gauge (02037500, arbitrary datum).
 */
export function rapidsClass(upriverGageFt: number): RapidsClassResult {
  for (const band of thresholds.rapidsClass.bands) {
    if (band.maxGageFt === null || upriverGageFt <= band.maxGageFt) {
      return { class: band.class as RapidsClassValue, label: band.label };
    }
  }
  // Fallback (should never reach — last band has maxGageFt: null)
  return { class: 'IV-V', label: 'Expert only / avoid' };
}

// ─── River-wide activity statuses ────────────────────────────────────────────

export type RiverwideActivitySlug =
  | 'swimming'
  | 'rock-hopping'
  | 'kayaking-whitewater'
  | 'hiking';

export interface RiverwideActivityStatus {
  slug:        RiverwideActivitySlug;
  status:      'safe' | 'caution' | 'deny';
  baseReason:  string; // deterministic reason; AI rewrites as a friendly note
}

export interface RiverwideInput {
  upriverGageFt:          number;
  waterTempF:             number | null;
  rain48hIn:              number;
  activeCSOAdvisory:      boolean;
  hasHighSeverityAdvisory: boolean;
}

/**
 * Returns exactly 4 river-wide activity statuses in canonical order:
 * swimming → rock-hopping → kayaking-whitewater → hiking.
 *
 * Thresholds key to USGS 02037500 (Westham upriver gauge).
 * The AI copies slug + status verbatim and writes a note field; it does not derive them.
 */
export function riverWideActivityStatuses(input: RiverwideInput): RiverwideActivityStatus[] {
  const { upriverGageFt, waterTempF, rain48hIn, activeCSOAdvisory } = input;
  const rw = thresholds.riverWideActivities;

  // ── Swimming ──────────────────────────────────────────────────────────────
  let swimStatus: 'safe' | 'caution' | 'deny' = 'safe';
  let swimReason = `Gage ${upriverGageFt} ft — normal range`;

  if (activeCSOAdvisory) {
    swimStatus = 'deny';
    swimReason = 'Active CSO overflow advisory — no swimming for 48 h';
  } else if (rain48hIn >= rw.swimming.rain48hTriggerIn) {
    swimStatus = 'deny';
    swimReason = `${rain48hIn.toFixed(1)}" rain in 48 h — bacterial contamination risk`;
  } else if (upriverGageFt > rw.swimming.denyMinGageFt) {
    swimStatus = 'deny';
    swimReason = `Gage ${upriverGageFt} ft — above ${rw.swimming.denyMinGageFt} ft swim deny threshold`;
  } else if (waterTempF !== null && waterTempF < rw.swimming.tempMinF) {
    swimStatus = 'caution';
    swimReason = `Water temp ${waterTempF}°F — below ${rw.swimming.tempMinF}°F cold threshold`;
  } else if (upriverGageFt > rw.swimming.safeMaxGageFt) {
    swimStatus = 'caution';
    swimReason = `Gage ${upriverGageFt} ft — elevated, strong swimmers only`;
  }

  // ── Rock-hopping ─────────────────────────────────────────────────────────
  let rockStatus: 'safe' | 'caution' | 'deny' = 'safe';
  let rockReason = `Gage ${upriverGageFt} ft — rocks well exposed`;

  if (upriverGageFt >= rw['rock-hopping'].denyMinGageFt) {
    rockStatus = 'deny';
    rockReason = `Gage ${upriverGageFt} ft — rocks submerged above ${rw['rock-hopping'].denyMinGageFt} ft`;
  } else if (upriverGageFt > rw['rock-hopping'].safeMaxGageFt) {
    rockStatus = 'caution';
    rockReason = `Gage ${upriverGageFt} ft — reduced rock exposure, slippery surfaces`;
  }

  // ── Kayaking / whitewater ─────────────────────────────────────────────────
  let kayakStatus: 'safe' | 'caution' | 'deny' = 'safe';
  let kayakReason = `Gage ${upriverGageFt} ft — Class ${rapidsClass(upriverGageFt).class} conditions`;

  if (upriverGageFt > rw['kayaking-whitewater'].denyMinGageFt) {
    kayakStatus = 'deny';
    kayakReason = `Gage ${upriverGageFt} ft — Class IV–V, expert or avoid`;
  } else if (upriverGageFt < rw['kayaking-whitewater'].safeMinGageFt) {
    kayakStatus = 'caution';
    kayakReason = `Gage ${upriverGageFt} ft — low flow, rocky hazards for paddlers`;
  } else if (upriverGageFt > rw['kayaking-whitewater'].safeMaxGageFt) {
    kayakStatus = 'caution';
    kayakReason = `Gage ${upriverGageFt} ft — Class III–IV, experienced paddlers only`;
  }

  // ── Hiking ────────────────────────────────────────────────────────────────
  let hikeStatus: 'safe' | 'caution' | 'deny' = 'safe';
  let hikeReason = 'All riverside trails open';

  if (upriverGageFt > rw.hiking.denyMinGageFt) {
    hikeStatus = 'deny';
    hikeReason = `Gage ${upriverGageFt} ft — flood stage, riverside trails closed`;
  } else if (input.hasHighSeverityAdvisory) {
    hikeStatus = 'caution';
    hikeReason = 'Active high-severity advisory — check trail conditions';
  }

  return [
    { slug: 'swimming',            status: swimStatus,  baseReason: swimReason },
    { slug: 'rock-hopping',        status: rockStatus,  baseReason: rockReason },
    { slug: 'kayaking-whitewater', status: kayakStatus, baseReason: kayakReason },
    { slug: 'hiking',              status: hikeStatus,  baseReason: hikeReason },
  ];
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

/**
 * Deterministic safety rules engine.
 * Pure functions — no I/O, no AI, no side effects.
 * Single source of truth alongside lib/safety/thresholds.json.
 */

import thresholds from './thresholds.json';
import type { UpstreamCsoSignal } from './upstream-cso';

/**
 * SafetyStatus includes 'closed' for locations that are operationally
 * unavailable (bridge out, park closure, etc.).
 *
 * 'closed' is NOT a worse safety level than 'danger' — it's a categorical
 * state meaning "unavailable regardless of conditions." Color mapping:
 *   closed  → neutral gray with lock icon (not red)
 *   danger  → red
 *   caution → yellow
 *   safe    → green
 */
export type SafetyStatus = 'safe' | 'caution' | 'danger' | 'closed';

/** Worst-of helper: danger > caution > safe. 'closed' is handled separately. */
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
 * Any rain above the trigger threshold → swim hold for 72h.
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
    swimReason = 'Active CSO overflow advisory — no swimming for 72 h';
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

/**
 * Verdict for activity slugs not covered by riverWideActivityStatuses.
 *
 * Migration 0016 (2026-06-02) added six new activity slugs to the
 * activities table — wade, rock-climbing, fishing, snorkeling, tubing,
 * bird-watching — plus surfaced bridge-crossing, belle-isle-pedestrian,
 * and beach-access on the per-location matrix.
 *
 * 2026-06-04 update: bridge-crossing + beach-access now consume their
 * existing thresholds.json values for real verdicts. The remaining new
 * slugs (wade, rock-climbing, fishing, snorkeling, tubing, bird-watching)
 * still return a generic "safe + check site" stub — they each warrant
 * specific rules in a future round, but no specific hazard surface
 * applies to them today beyond what the global gage / temperature /
 * advisory escalation already covers at the location level.
 */
export type NonRiverwideActivitySlug =
  | 'wade'
  | 'rock-climbing'
  | 'fishing'
  | 'snorkeling'
  | 'tubing'
  | 'bird-watching'
  | 'bridge-crossing'
  | 'belle-isle-pedestrian'
  | 'beach-access'
  | 'kayak-flatwater';

export interface NonRiverwideInput {
  /** Current Westham gauge reading in ft, or null when unavailable. */
  gageFt: number | null;
}

export function nonRiverwideActivityVerdict(
  slug: string,
  input: NonRiverwideInput,
): { status: 'safe' | 'caution' | 'deny'; baseReason: string } {
  switch (slug) {
    case 'bridge-crossing':
    case 'belle-isle-pedestrian': {
      // Both pedestrian bridges (Potterfield + Belle Isle Pedestrian) sit
      // ~20 ft above the river. The HEC-RAS model says deck overtopping at
      // 25 ft, but the City has demonstrated they'll close the bridge below
      // overtopping during severe events (Hurricane Florence Sep 2018
      // closed Potterfield at ~13 ft Westham per local recall). The
      // bridge_crossing.gage_deny_above_ft threshold reflects this
      // operational precedent, not the physical overtopping number.
      if (input.gageFt === null) return { status: 'safe', baseReason: '' };
      const denyAbove = thresholds.activities.bridge_crossing.gage_deny_above_ft;
      if (input.gageFt > denyAbove) {
        return {
          status: 'deny',
          baseReason: `Gage ${input.gageFt} ft — bridge may be closed at this stage`,
        };
      }
      return { status: 'safe', baseReason: '' };
    }
    case 'beach-access': {
      // Shore/beach access. Existing threshold from thresholds.json:
      // gage_deny_above_ft 8 ft — beach features (sand strips, low rocks,
      // shore staging areas) become submerged at moderate-high flows.
      // Per-location nuance (Pony Pasture's beach_submerge_ft 6.0,
      // Browns Island's riverbank_inundate_ft 11.0) is not consumed here;
      // those are descriptive informational fields and are surfaced via
      // location.flood_close_ft when they translate to a closure.
      if (input.gageFt === null) return { status: 'safe', baseReason: '' };
      const denyAbove = thresholds.activities.beach_access.gage_deny_above_ft;
      if (input.gageFt > denyAbove) {
        return {
          status: 'deny',
          baseReason: `Gage ${input.gageFt} ft — beach access submerged`,
        };
      }
      return { status: 'safe', baseReason: '' };
    }
    case 'kayak-flatwater': {
      // Calm-water paddling — Huguenot Flatwater (upstream of the falls) and
      // Chapel Island (tidal launch). Distinct from kayak-rapids which models
      // Westham gauge → rapids class for whitewater. For flatwater, the
      // gauge still escalates conditions (debris, current speed near put-in)
      // but the band is narrower: safe through ~4 ft, caution through 5.5,
      // deny above 5.5 (where flatwater carries debris and current speeds
      // become unsafe for beginners even in calm-water pools).
      if (input.gageFt === null) return { status: 'safe', baseReason: '' };
      const kf = thresholds.activities.kayak_flatwater;
      if (input.gageFt > kf.gage_deny_above_ft) {
        return {
          status: 'deny',
          baseReason: `Gage ${input.gageFt} ft — too high for calm-water paddling`,
        };
      }
      if (input.gageFt > kf.gage_safe_max_ft) {
        return {
          status: 'caution',
          baseReason: `Gage ${input.gageFt} ft — paddle with experience, PFD required`,
        };
      }
      return {
        status: 'safe',
        baseReason: `Gage ${input.gageFt} ft — calm conditions, PFD required`,
      };
    }
    case 'wade':
    case 'rock-climbing':
    case 'fishing':
    case 'snorkeling':
    case 'tubing':
    case 'bird-watching':
      // No specific gauge-based rule yet. The global gage-band logic at
      // the location level (combinedLocationStatus) already escalates the
      // whole location to caution/danger when conditions warrant, so the
      // user sees the warning at the tile level; the per-activity verdict
      // here defaults to 'safe' with a check-site note.
      return { status: 'safe', baseReason: 'Conditions vary — check site before visiting' };
    default:
      return { status: 'safe', baseReason: '' };
  }
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
 * Operational closure/restriction status — overlaid on weather-based assessment.
 * Supplied by the location_status table (sub-goal 43).
 *
 * kind 'open' → no override
 * kind 'restricted' → worst(caution, weather) with combined reason
 * kind 'closed' | 'closed_indefinite' → status='closed' unconditionally
 */
export interface OperationalStatusOverride {
  kind: 'open' | 'restricted' | 'closed' | 'closed_indefinite';
  reason: string;
  affects: string | null;
}

/**
 * Combines all rules and returns the worst status plus a human-readable reason.
 * Used by LocationCard to produce a deterministic status pill without AI.
 *
 * When `operationalStatus` is provided:
 *   - 'closed' / 'closed_indefinite': returns { status: 'closed' } immediately.
 *   - 'restricted': escalates to caution + prepends the restriction note.
 *   - 'open': no override.
 *
 * When `upstreamCso` is provided and count > 0, swimming locations are
 * escalated to 'caution' (but never below an existing 'danger' or 'closed').
 */
export function combinedLocationStatus(
  metro: MetroStateInput,
  advisories: Array<{ kind: string; severity: string; headline: string }>,
  locationSlug: string,
  operationalStatus?: OperationalStatusOverride | null,
  upstreamCso?: UpstreamCsoSignal | null,
  locationTags?: string[],
): CombinedStatus {
  // ── Operational closure takes precedence over everything ──────────────────
  if (
    operationalStatus &&
    (operationalStatus.kind === 'closed' ||
      operationalStatus.kind === 'closed_indefinite')
  ) {
    const scopeLabel = operationalStatus.affects
      ? `${operationalStatus.affects}: `
      : '';
    return {
      status: 'closed',
      reason: `${scopeLabel}${operationalStatus.reason}`,
      label:  'Access closed',
    };
  }
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

  // 3. High-severity NON-CSO advisory (severe weather, water quality) overrides
  // to danger metro-wide. CSO is excluded here and handled per-location in
  // step 4 — sewer overflows flow downstream, so a metro CSO doesn't make EVERY
  // location unsafe. Flagging unaffected spots produced the contradiction of a
  // "no swimming for 72 h" header on cards that also read "No overflows
  // upstream", and "no swimming" on non-swim sites. The top-of-page CsoBanner
  // still carries the metro-wide CSO warning, so this doesn't under-warn.
  const severeNonCso = advisories.find(
    (a) => (a.severity === 'high' || a.severity === 'extreme') && a.kind !== 'cso_overflow',
  );
  if (severeNonCso) {
    status = 'danger';
    reason = severeNonCso.headline;
  }

  // 4. CSO — per-location via the upstream signal, NOT the metro-wide advisory
  // list. A location is only affected when an overflow is active UPSTREAM of it
  // (contamination flows downstream). Swim spots → no-swimming (danger);
  // non-swim river access → avoid water contact (caution).
  const upstreamCsoCount = upstreamCso?.count ?? 0;
  const isSwimmingLocation = locationTags?.includes('swimming') ?? false;
  if (upstreamCsoCount > 0) {
    if (isSwimmingLocation) {
      status = worst(status, 'danger');
      reason = 'Sewer overflow upstream — no swimming for 72 h';
    } else {
      status = worst(status, 'caution');
      reason = 'Sewer overflow upstream — avoid water contact for 72 h';
    }
  }

  // 5. Post-rain swim hold
  const rainStatus = postRainSwimStatus(metro.precip48hIn);
  status = worst(status, rainStatus);
  if (rainStatus === 'caution' && status === 'caution') {
    reason = `${(metro.precip48hIn ?? 0).toFixed(1)}" recent rain — 72 h swim hold`;
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

  // (Upstream CSO is handled in step 4 above — per-location, swim vs non-swim.)

  // ── Restricted operational status: escalate to caution, prepend note ────
  if (operationalStatus?.kind === 'restricted') {
    status = worst(status, 'caution');
    const scope = operationalStatus.affects ? `${operationalStatus.affects} restricted` : 'Restricted access';
    reason = `${scope}; ${reason}`;
  }

  // Derive pill label from final status + gage
  const label =
    status === 'danger'
      ? metro.gageFt !== null && metro.gageFt > thresholds.gage.high_max_ft
        ? 'High water'
        : 'Check advisories'
      : status === 'caution'
        ? operationalStatus?.kind === 'restricted'
          ? 'Restricted access'
          : metro.gageFt !== null && metro.gageFt > thresholds.gage.normal_max_ft
            ? 'Elevated flow'
            : 'Use caution'
        : 'Good conditions';

  return { status, reason, label };
}

// ─── River condition summary (sub-goal 37) ───────────────────────────────────

export type RiverBand = 'low' | 'normal' | 'elevated' | 'high' | 'flood';

export interface RiverConditionSummary {
  band:        RiverBand;
  /** 2–5 word qualitative headline, e.g. "Calm & Normal". */
  headline:    string;
  /** e.g. "0.4 ft above seasonal median" or null when no percentile data */
  deltaLabel:  string | null;
  status:      SafetyStatus;
  /** ≤18-word plain-language translation of conditions. */
  translation: string;
}

/** Discharge (CFS) context — uses seasonal discharge percentiles when available. */
interface DischargeNormal {
  p25: number;
  p50: number;
  p75: number;
  unit: 'cfs';
}

/** Full input for riverConditionSummary. */
export interface RiverConditionInput {
  currentGageFt:           number;
  /** Discharge percentile data for the current day-of-year. May be null. */
  dischargeNormal:         DischargeNormal | null;
  /** Current discharge (CFS) for comparing to percentiles. */
  currentDischargeCfs:     number | null;
  rapidsClass:             RapidsClassValue;
  activeAdvisorySeverity:  'low' | 'medium' | 'high' | 'extreme' | null;
  /** Age bucket for child-friendly variant. */
  ageBucket?:              string | null;
}

type BandConfig = {
  name:        string;
  maxGageFt:   number | null;
  label:       string;
  statusClass: string;
};

function getBand(gageFt: number): { band: RiverBand; config: BandConfig } {
  for (const b of thresholds.riverState.bands as BandConfig[]) {
    if (b.maxGageFt === null || gageFt <= b.maxGageFt) {
      return { band: b.name as RiverBand, config: b };
    }
  }
  const last = thresholds.riverState.bands[thresholds.riverState.bands.length - 1] as BandConfig;
  return { band: 'flood', config: last };
}

const TRANSLATIONS: Record<RiverBand, { adult: string; child: string }> = {
  low: {
    adult: 'River is low and slow — rocks exposed at Belle Isle, calm rapids.',
    child: 'River is low and gentle — great for wading, lots of rocks to explore.',
  },
  normal: {
    adult: 'River is running normal for the season — typical conditions across access points.',
    child: 'River is running normally — good conditions for families at most spots.',
  },
  elevated: {
    adult: 'River is running above seasonal average — faster current, some shoreline rocks underwater.',
    child: 'River is a bit higher than usual — stay close to shore, stronger currents.',
  },
  high: {
    adult: 'River is high and moving fast — many rocks submerged, rapids more challenging.',
    child: 'River is high and fast — wade only in very calm, shallow areas with an adult.',
  },
  flood: {
    adult: 'River is at or above flood stage — keep clear of the riverbanks.',
    child: 'River is flooding — stay away from the water entirely.',
  },
};

const CHILD_BUCKETS = new Set(['0-2', '3-5', '6-9']);

function isChildBucket(ageBucket: string | null | undefined): boolean {
  return Boolean(ageBucket && CHILD_BUCKETS.has(ageBucket));
}

/**
 * Deterministic river condition summary combining band, status, and a
 * plain-language translation sentence. Pure function — no I/O.
 */
export function riverConditionSummary(input: RiverConditionInput): RiverConditionSummary {
  const { band, config } = getBand(input.currentGageFt);

  // Status from band config
  const status: SafetyStatus =
    config.statusClass === 'danger'
      ? 'danger'
      : config.statusClass === 'caution'
        ? 'caution'
        : 'safe';

  // Override to danger if active high/extreme advisory
  const finalStatus: SafetyStatus =
    input.activeAdvisorySeverity === 'high' || input.activeAdvisorySeverity === 'extreme'
      ? 'danger'
      : status;

  // Delta label from discharge percentiles
  let deltaLabel: string | null = null;
  if (
    input.dischargeNormal &&
    input.currentDischargeCfs !== null
  ) {
    const { p50 } = input.dischargeNormal;
    const diff = input.currentDischargeCfs - p50;
    const absDiff = Math.abs(diff);
    if (absDiff < p50 * 0.05) {
      deltaLabel = 'near seasonal median flow';
    } else {
      const k = absDiff >= 1000
        ? `${(absDiff / 1000).toFixed(1)}k`
        : `${Math.round(absDiff).toLocaleString()}`;
      deltaLabel =
        diff > 0
          ? `${k} cfs above seasonal median`
          : `${k} cfs below seasonal median`;
    }
  }

  // Translation
  const useChild = isChildBucket(input.ageBucket);
  const tpl = TRANSLATIONS[band];
  const translation = useChild ? tpl.child : tpl.adult;

  return {
    band,
    headline:   config.label,
    deltaLabel,
    status:     finalStatus,
    translation,
  };
}

// ─── Richmond Conditions — sub-goal 87 ────────────────────────────────────────
//
// Functions powering the Richmond Conditions section above the homepage's
// river panel. All deterministic; AI consumes none of these — it narrates
// alongside via the `richmond_microcopy` field (sub-goal 89).
//
// Reads scoring/band config from `thresholds.json` → `richmondConditions`.

import { type HeatStressZone } from '@/lib/utils/wet-bulb';

const RC = thresholds.richmondConditions;

// ── Swim Today ────────────────────────────────────────────────────────────────

export type SwimStatus = 'recommended' | 'wade' | 'avoid';

export interface SwimTodayInput {
  /** Latest water temperature in °F. Null when no fresh reading is available. */
  waterTempF: number | null;
  /** JRA water-quality bacterial advisory in effect right now. */
  bacterialAdvisoryActive: boolean;
  /** Active CSO advisory window covers today. */
  csoActiveRecent: boolean;
  /** River is at or above flood stage. */
  floodStage: boolean;
  /**
   * Latest Westham gage height (ft). Null when no fresh reading. Used to deny
   * swimming once the river is above the swim-deny threshold — the same
   * threshold the per-location swim chips use, so the headline swim verdict and
   * the location cards can't disagree.
   */
  gageFt: number | null;
}

export interface SwimTodayResult {
  status: SwimStatus;
  /** Single-line reason surfaced under the badge. */
  primaryReason: string;
  /** Additional reasons revealed on tap / tooltip. Always includes primaryReason. */
  contributingReasons: string[];
}

/**
 * Decide swim status for the day.
 *
 * Avoid reasons are tried in priority order so the most actionable signal is
 * the primary one shown under the badge:
 *   1. flood stage    (physical hazard, overrides everything)
 *   2. high water     (gage above the swim-deny threshold — strong current)
 *   3. bacterial      (health hazard, water quality already failed)
 *   4. CSO window     (health hazard, contamination probable)
 *   5. cold water     (hypothermia / shock risk under 60°F)
 * Then:
 *   60 ≤ T < 70 → wade-only (too cold for swim, ok for ankle play)
 *   T ≥ 70     → recommended
 *   null T     → wade with explicit "data unavailable" reason
 */
export function swimToday(input: SwimTodayInput): SwimTodayResult {
  const reasons: string[] = [];

  const swimDenyGageFt = thresholds.riverWideActivities.swimming.denyMinGageFt;
  if (input.floodStage) {
    reasons.push('River at flood stage — strong currents and submerged hazards.');
  } else if (input.gageFt !== null && input.gageFt > swimDenyGageFt) {
    // Below flood stage but above the swim-deny gage — matches the per-location
    // swim chips so the headline verdict and the cards stay consistent.
    reasons.push(
      `River is high at ${input.gageFt.toFixed(1)} ft — strong current, swimming unsafe above ${swimDenyGageFt} ft.`,
    );
  }
  if (input.bacterialAdvisoryActive) {
    reasons.push('Bacterial water-quality advisory in effect.');
  }
  if (input.csoActiveRecent) {
    reasons.push('Sewer overflow in the past 72 hours — bacterial contamination likely.');
  }
  if (input.waterTempF !== null && input.waterTempF < 60) {
    reasons.push(`Water is ${input.waterTempF.toFixed(0)}°F — too cold for safe immersion.`);
  }

  if (reasons.length > 0) {
    return {
      status:              'avoid',
      primaryReason:       reasons[0],
      contributingReasons: reasons,
    };
  }

  if (input.waterTempF === null) {
    const reason = 'Water temperature unavailable — wade with caution.';
    return {
      status:              'wade',
      primaryReason:       reason,
      contributingReasons: [reason],
    };
  }

  if (input.waterTempF < RC.swim.recommended_min_water_f) {
    const reason = `Water is ${input.waterTempF.toFixed(0)}°F — comfortable for wading, cool for swimming.`;
    return {
      status:              'wade',
      primaryReason:       reason,
      contributingReasons: [reason],
    };
  }

  const reason = `Water is ${input.waterTempF.toFixed(0)}°F — comfortable for swimming.`;
  return {
    status:              'recommended',
    primaryReason:       reason,
    contributingReasons: [reason],
  };
}

// ── Happiness Index ───────────────────────────────────────────────────────────

export type HappinessBand = 'excellent' | 'good' | 'fair' | 'poor' | 'avoid';

export interface HappinessIndexInput {
  waterTempF:    number | null;
  apparentTempF: number;
  wetBulbF:      number;
  /** Max precipitation probability in the next 4 hours, 0–100. */
  precip4hChance: number;
  uv:            number;
  advisorySeverity: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  closuresAtTopLocations: number;
}

export interface HappinessIndexResult {
  score: number;
  band: HappinessBand;
  bandLabel: string;
}

/**
 * Compute holistic happiness score (0–100) for "is this a nice day to be at
 * the river overall?" Starts at 100 and subtracts penalties.
 *
 * Penalty table (each capped, see code for the cap values):
 *   water temp out of [72, 84]°F   : -2 per °F off, cap -25
 *   apparent temp out of [68, 82]°F: -2 per °F off, cap -20
 *   wet bulb zone                  : 0 / -10 / -25 / -40 / -60
 *   precip 4h chance               : -0.3 per pct, cap -30
 *   UV                             : 0 (<8), -10 (8-9), -15 (≥10)
 *   advisory severity              : 0 / -5 / -15 / -30 / -45
 *   closures at top locations      : -3 per, cap -15
 *
 * Null water temp does not penalise — uncertainty isn't badness.
 */
export function happinessIndex(input: HappinessIndexInput): HappinessIndexResult {
  const cfg = RC.happinessIndex;
  let score = 100;

  // Water temp deviation from the ideal band
  if (input.waterTempF !== null) {
    const wOff =
      input.waterTempF < cfg.ideal_water_min_f
        ? cfg.ideal_water_min_f - input.waterTempF
        : input.waterTempF > cfg.ideal_water_max_f
          ? input.waterTempF - cfg.ideal_water_max_f
          : 0;
    score -= Math.min(25, wOff * 2);
  }

  // Apparent temp deviation
  const aOff =
    input.apparentTempF < cfg.ideal_apparent_min_f
      ? cfg.ideal_apparent_min_f - input.apparentTempF
      : input.apparentTempF > cfg.ideal_apparent_max_f
        ? input.apparentTempF - cfg.ideal_apparent_max_f
        : 0;
  score -= Math.min(20, aOff * 2);

  // Wet bulb zone — map via heatStressZone thresholds (same as wet-bulb.ts)
  const zone: HeatStressZone =
    input.wetBulbF >= 90 ? 'avoid'
    : input.wetBulbF >= 88 ? 'danger'
    : input.wetBulbF >= 85 ? 'extreme'
    : input.wetBulbF >= 80 ? 'caution'
    : 'normal';
  score -= { normal: 0, caution: 10, extreme: 25, danger: 40, avoid: 60 }[zone];

  // Precipitation
  score -= Math.min(30, input.precip4hChance * 0.3);

  // UV (only at high values; mild UV doesn't move the needle)
  if      (input.uv >= 10) score -= 15;
  else if (input.uv >=  8) score -= 10;

  // Advisories
  score -= { none: 0, low: 5, moderate: 15, high: 30, extreme: 45 }[input.advisorySeverity];

  // Closures
  score -= Math.min(15, input.closuresAtTopLocations * 3);

  // Clamp + map to band
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = cfg.bands.find((b) => score >= b.min_score) ?? cfg.bands[cfg.bands.length - 1];

  return {
    score,
    band:      band.name as HappinessBand,
    bandLabel: band.label,
  };
}

// ── Headline (deterministic, paired with AI microcopy) ────────────────────────

// ── Severe weather (NWS watches / warnings) ─────────────────────────────────

export type SevereWeatherTier = 'none' | 'watch' | 'warning';

export interface SevereWeatherAdvisoryInput {
  kind: string;
  severity: string;
  headline: string;
}

export interface SevereWeatherResult {
  tier: SevereWeatherTier;
  /** Headlines of the alerts that drove the tier (warnings first). */
  headlines: string[];
  /** Family-facing single line for the banner. Empty when tier === 'none'. */
  message: string;
}

const FLOOD_ALERT_KINDS = new Set(['flood_warning', 'flood_watch', 'flood_advisory']);

/**
 * Deterministic severe-weather gate from active NWS alerts. Like every other
 * verdict here, the AI never decides this — it only narrates around it (and is
 * now told about it so it stops recommending activities under a watch).
 *
 *   'warning' — imminent danger: a *warning* product (flood / severe
 *               thunderstorm / tornado warning) or any extreme-severity alert.
 *   'watch'   — conditions favorable: a flood watch/advisory or severe
 *               thunderstorm watch (high-severity weather alert).
 *
 * Floods are keyed by `kind`. Thunderstorm/tornado alerts arrive as kind
 * 'general' (no enum value for them), so they're keyed by severity
 * (Severe/Extreme → high/extreme) plus the headline text to separate a Watch
 * from a Warning — both map to 'high'. Non-weather advisories (cso_overflow,
 * water_quality) never trigger this.
 */
export function severeWeatherStatus(
  advisories: SevereWeatherAdvisoryInput[],
): SevereWeatherResult {
  const warnings: string[] = [];
  const watches: string[] = [];

  for (const a of advisories) {
    const isFlood = FLOOD_ALERT_KINDS.has(a.kind);
    const isSevereGeneral =
      a.kind === 'general' && (a.severity === 'high' || a.severity === 'extreme');
    if (!isFlood && !isSevereGeneral) continue; // not a severe-weather alert

    const headline = a.headline.toLowerCase();
    const isWarning =
      a.kind === 'flood_warning' || a.severity === 'extreme' || /\bwarning\b/.test(headline);
    (isWarning ? warnings : watches).push(a.headline);
  }

  if (warnings.length > 0) {
    return {
      tier: 'warning',
      headlines: [...warnings, ...watches],
      message: 'Severe weather warning in effect — seek shelter, stay off the river.',
    };
  }
  if (watches.length > 0) {
    return {
      tier: 'watch',
      headlines: watches,
      message:
        'Severe weather watch in effect — conditions can turn dangerous fast. Not a good day for the river.',
    };
  }
  return { tier: 'none', headlines: [], message: '' };
}

/**
 * Returns a 3–7 word headline for the section. The full table is too large
 * to enumerate (5 bands × 3 swim × 5 zones = 75 combos) — we cover the
 * common cases explicitly and fall back to a band-only headline otherwise.
 *
 * Editorial principles (per user review 2026-06-02):
 *   1. No directional language ("water still warming" / "water's a bit
 *      cool"). Seasonally false in fall. State conditions, not trajectory.
 *   2. Heat warnings always include "water" + "shade" guidance.
 *   3. Swim status surfaced when meaningful:
 *        - wade  → "good for wading"
 *        - avoid → "swimming not recommended" (informative, not alarming)
 *        - recommended → no special mention (the day's headline carries it)
 *
 * Why pair this with AI microcopy: the headline is the LCP-eligible
 * deterministic text (paints from initial HTML); the AI sentence below
 * adds situational context that varies day to day.
 */
export function headlineForRichmondConditions(
  band: HappinessBand,
  swim: SwimStatus,
  heatZone: HeatStressZone,
  severeWeather: SevereWeatherTier = 'none',
): string {
  // ── Severe weather overrides everything ──────────────────────────────────
  // An active NWS watch/warning is a physical-safety signal that trumps any
  // happiness/heat/swim framing — never show a cheerful headline under it.
  if (severeWeather === 'warning') return 'Severe weather — seek shelter now';
  if (severeWeather === 'watch')   return 'Severe weather watch — skip the river';

  // ── Highest-severity gates ──────────────────────────────────────────────
  if (band === 'avoid')                                  return 'Stay home today';
  if (heatZone === 'avoid' || heatZone === 'danger')     return 'Heat alert — water and shade today';
  if (band === 'poor' && heatZone === 'extreme')         return 'Hot day — pack water, find shade';
  if (band === 'poor')                                   return 'Tough conditions today';

  // ── Fair band ───────────────────────────────────────────────────────────
  if (band === 'fair' && heatZone === 'caution')         return 'OK day — pack water';
  if (band === 'fair')                                   return 'Fair day to be out';

  // ── Good band (modulated by swim status) ────────────────────────────────
  if (band === 'good' && swim === 'wade')                return 'Decent day — good for wading';
  if (band === 'good' && swim === 'avoid')               return 'Decent day, but swimming not recommended';
  if (band === 'good')                                   return 'Solid day for the river'; // swim recommended

  // ── Excellent band (heat caution still gets water+shade) ────────────────
  if (band === 'excellent' && swim === 'recommended' && heatZone === 'caution') {
    return 'Good day — pack water, take shade breaks';
  }
  if (band === 'excellent' && swim === 'wade')           return 'Great day — good for wading';
  if (band === 'excellent' && swim === 'avoid')          return 'Great day, but swimming not recommended';
  if (band === 'excellent')                              return 'Great day to head out';

  // Fallback (should be unreachable)
  return 'Check conditions before heading out';
}

// ── Next Hours Outlook ────────────────────────────────────────────────────────

export interface HourlyForecast {
  /** Period start time, ISO string. Used only for relative ordering. */
  startTimeIso:    string;
  /** Ambient air temperature in °F. */
  ambientF:        number;
  /** Apparent temperature in °F (caller pre-computes via apparentTemperatureF). */
  apparentF:       number;
  /** Precipitation probability, 0–100. */
  precipChancePct: number;
  /** NWS-style short forecast string e.g. "Mostly Sunny", "Showers Likely". */
  shortForecast:   string;
}

export type SkyCover = 'clear' | 'partly' | 'mostly cloudy' | 'overcast';
export type Trend    = 'rising' | 'falling' | 'steady';

export interface NextHoursOutlook {
  precipitationChance:  number;
  precipitationSummary: string;
  skyCover:             SkyCover;
  temperatureTrend:     Trend;
  apparentTempTrend:    Trend;
  series: Array<{
    hourIso:         string;
    ambientF:        number;
    apparentF:       number;
    precipChancePct: number;
  }>;
}

/**
 * Derives the next-N-hours outlook from an NWS-style hourly forecast.
 * Caller is responsible for slicing/aligning the input array to "from now"
 * — we just take the first N entries.
 *
 * shortForecast strings drive both the precipitation summary (when rain is
 * implied) and the sky cover bucket. The matching is intentionally loose to
 * absorb NWS phrasing variants ("Showers Likely" vs "Chance Showers" etc.).
 */
export function nextHoursOutlook(
  hourly: HourlyForecast[],
  hours: number = 4,
): NextHoursOutlook {
  const window = hourly.slice(0, hours);

  if (window.length === 0) {
    return {
      precipitationChance:  0,
      precipitationSummary: 'No data',
      skyCover:             'partly',
      temperatureTrend:     'steady',
      apparentTempTrend:    'steady',
      series:               [],
    };
  }

  const precipitationChance = Math.max(...window.map((p) => p.precipChancePct));

  // Sky cover bucket — vote across the window via keyword presence.
  // First match wins per priority: overcast > mostly cloudy > partly > clear.
  const forecastBlob = window.map((p) => p.shortForecast.toLowerCase()).join(' ');
  const skyCover: SkyCover =
      forecastBlob.includes('overcast')                                 ? 'overcast'
    : forecastBlob.includes('cloudy') || forecastBlob.includes('mostly')? 'mostly cloudy'
    : forecastBlob.includes('partly') || forecastBlob.includes('few')   ? 'partly'
    : 'clear';

  // Precipitation summary — derive from worst forecast term in the window.
  const precipitationSummary = (() => {
    if (forecastBlob.includes('thunder')) return 'Thunderstorms possible';
    if (forecastBlob.includes('heavy'))   return 'Heavy rain';
    if (forecastBlob.includes('rain') || forecastBlob.includes('showers')) {
      return precipitationChance >= 60 ? 'Rain likely' : 'Showers possible';
    }
    if (precipitationChance >= 30) return 'Chance of precipitation';
    return 'No rain expected';
  })();

  const trend = (start: number, end: number): Trend => {
    const delta = end - start;
    if (delta >=  2) return 'rising';
    if (delta <= -2) return 'falling';
    return 'steady';
  };

  const temperatureTrend  = trend(window[0].ambientF,  window[window.length - 1].ambientF);
  const apparentTempTrend = trend(window[0].apparentF, window[window.length - 1].apparentF);

  return {
    precipitationChance,
    precipitationSummary,
    skyCover,
    temperatureTrend,
    apparentTempTrend,
    series: window.map((p) => ({
      hourIso:         p.startTimeIso,
      ambientF:        p.ambientF,
      apparentF:       p.apparentF,
      precipChancePct: p.precipChancePct,
    })),
  };
}

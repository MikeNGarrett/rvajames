/**
 * Wet-bulb temperature (Stull 2011 approximation) + heat-stress zones.
 *
 * Wet-bulb temperature is the temperature a parcel of air would reach if
 * cooled adiabatically to saturation by evaporating water into it. It's
 * the physiologically meaningful measure of "how easily can the human
 * body shed heat?" — high wet bulb means sweat doesn't evaporate well.
 *
 * Stull (2011) approximation in °C:
 *   Tw = T·atan(0.151977·(RH+8.313659)^0.5)
 *       + atan(T+RH) − atan(RH−1.676331)
 *       + 0.00391838·RH^1.5·atan(0.023101·RH)
 *       − 4.686035
 *
 * Accurate within ±0.5°C for RH 5–99% and T −20 to +50°C. Citation:
 *   Stull, R. (2011). "Wet-Bulb Temperature from Relative Humidity
 *   and Air Temperature." Journal of Applied Meteorology and
 *   Climatology, 50(11), 2267-2269.
 *
 * Heat-stress zones map wet-bulb °F to OSHA/NWS outdoor-activity
 * guidance bands. The thresholds are conservative for family activity
 * with kids (per project context) — they shift one band cooler than
 * standard adult athletic guidance.
 */

/** Convert °F to °C. */
function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}

/** Convert °C to °F. */
function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

/**
 * Wet-bulb temperature in °F (Stull 2011 approximation).
 *
 * Implementation note: Stull's formula expects temperature in °C and
 * relative humidity as a percentage 0–100 (not 0–1). We convert in/out
 * of °F so the public API matches the rest of this codebase.
 */
export function wetBulbF(ambientF: number, relativeHumidityPct: number): number {
  const T  = fToC(ambientF);
  const RH = relativeHumidityPct;

  const tw =
      T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659))
    + Math.atan(T + RH)
    - Math.atan(RH - 1.676331)
    + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH)
    - 4.686035;

  return cToF(tw);
}

/**
 * Heat-stress zone for outdoor activity, based on wet-bulb °F.
 *
 * Tuned conservative for families with young kids at the river — these
 * bands shift one notch cooler than standard adult athletic guidance.
 *   normal   < 80°F  — comfortable; no special precautions
 *   caution  80–85°F  — drink water; consider shade breaks
 *   extreme  85–88°F  — limit activity to morning / late evening
 *   danger   88–90°F  — outdoor activity inadvisable; immediate risk
 *   avoid    ≥ 90°F  — heat illness highly likely; stay indoors
 */
export type HeatStressZone =
  | 'normal'
  | 'caution'
  | 'extreme'
  | 'danger'
  | 'avoid';

export function heatStressZone(wetBulb: number): HeatStressZone {
  if (wetBulb >= 90) return 'avoid';
  if (wetBulb >= 88) return 'danger';
  if (wetBulb >= 85) return 'extreme';
  if (wetBulb >= 80) return 'caution';
  return 'normal';
}

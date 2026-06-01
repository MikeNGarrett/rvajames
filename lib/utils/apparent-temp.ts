/**
 * Apparent temperature ("feels like") — NWS-standard formulas.
 *
 * Three regimes per NWS Weather Forecast Office practice:
 *   - HOT (T ≥ 80°F, RH ≥ 40%) → Rothfusz heat-index regression
 *   - COLD (T ≤ 50°F, wind > 3 mph) → NWS wind-chill formula
 *   - MIDDLE → ambient T unchanged (no perceptual adjustment)
 *
 * Citations:
 *   - Rothfusz heat index: National Weather Service Technical Attachment
 *     SR 90-23 (Steadman 1979, simplified by Rothfusz 1990).
 *     https://www.weather.gov/media/ffc/ta_htindx.PDF
 *   - Wind chill: NWS / Environment Canada joint formula adopted Nov 2001.
 *     https://www.weather.gov/safety/cold-wind-chill-chart
 *
 * Tests live in `apparent-temp.test.ts`. NWS reference pairs included.
 */

/**
 * Rothfusz heat index in °F.
 *
 * Valid for T ≥ 80°F and RH ≥ 40%. Below those thresholds returns the
 * ambient temperature unchanged (no "cooler than air" claim is justified
 * by the regression).
 *
 * The simple Rothfusz formula has a noted underestimate at low humidity
 * and overestimate at high humidity; the official NWS implementation
 * applies adjustment terms for those edges. Both are included here.
 */
function heatIndexF(tempF: number, relativeHumidityPct: number): number {
  // Below the regression's valid range — no heat-index adjustment.
  if (tempF < 80 || relativeHumidityPct < 40) return tempF;

  const T  = tempF;
  const RH = relativeHumidityPct;

  // Rothfusz simplified formula (returns °F).
  let HI =
      -42.379
    +   2.04901523 * T
    +  10.14333127 * RH
    -   0.22475541 * T * RH
    -   0.00683783 * T * T
    -   0.05481717 * RH * RH
    +   0.00122874 * T * T * RH
    +   0.00085282 * T * RH * RH
    -   0.00000199 * T * T * RH * RH;

  // ── Adjustments from the NWS reference implementation ──────────────────
  // Low-humidity correction (RH < 13% and T in 80–112°F).
  if (RH < 13 && T >= 80 && T <= 112) {
    const adjustment = ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    HI -= adjustment;
  }
  // High-humidity correction (RH > 85% and T in 80–87°F).
  else if (RH > 85 && T >= 80 && T <= 87) {
    const adjustment = ((RH - 85) / 10) * ((87 - T) / 5);
    HI += adjustment;
  }

  return HI;
}

/**
 * NWS wind-chill °F.
 *
 * Valid for T ≤ 50°F and wind > 3 mph. Outside those bounds returns
 * ambient T. The official formula (NWS/Environment Canada, 2001):
 *
 *   WC = 35.74 + 0.6215·T − 35.75·(V^0.16) + 0.4275·T·(V^0.16)
 *
 * where T is in °F and V is wind speed in mph.
 */
function windChillF(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph <= 3) return tempF;
  const V016 = Math.pow(windMph, 0.16);
  return 35.74 + 0.6215 * tempF - 35.75 * V016 + 0.4275 * tempF * V016;
}

/**
 * Apparent temperature in °F. Picks the regime appropriate to the
 * ambient conditions; falls back to ambient T when neither regime
 * applies (e.g. mild day, low wind).
 */
export function apparentTemperatureF(
  ambientF: number,
  relativeHumidityPct: number,
  windMph: number,
): number {
  // Hot regime takes precedence (rare overlap with cold).
  if (ambientF >= 80 && relativeHumidityPct >= 40) {
    return heatIndexF(ambientF, relativeHumidityPct);
  }
  if (ambientF <= 50 && windMph > 3) {
    return windChillF(ambientF, windMph);
  }
  return ambientF;
}

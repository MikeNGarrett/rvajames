/**
 * Eastern-Time hourly alignment helpers.
 *
 * Background — the bug these prevent (2026-06-09):
 *   The Richmond Conditions resolver read `omHours[0]` as "current hour."
 *   But the Open-Meteo ingest requests `&timezone=America/New_York` with no
 *   `start_hour`, so Open-Meteo returns hours starting at 00:00 TODAY ET.
 *   `omHours[0]` was therefore ALWAYS today's midnight — the overnight low,
 *   with UV 0 — not the actual current hour. On a summer afternoon the
 *   dashboard showed "feels like 62°F / UV 0" while it was 82°F outside.
 *
 *   Meanwhile the NWS `/forecast/hourly` endpoint returns periods starting
 *   at the CURRENT hour, so the two arrays are NOT index-aligned. Anything
 *   that zipped them by index (`omHours[i]` against `periods[i]`) mismatched
 *   humidity/wind against temperature.
 *
 * The fix: align both sources by ET calendar-hour KEY ("YYYY-MM-DDTHH")
 * instead of by array index, and select the current hour by real wall-clock
 * time rather than position 0.
 *
 * Why a string key works: both sources emit ET-local timestamps for the same
 * calendar hour. Open-Meteo: "2026-06-09T14:00". NWS: "2026-06-09T14:00:00-04:00".
 * The first 13 characters ("2026-06-09T14") identify the ET hour for both.
 */

/**
 * ET calendar-hour key ("YYYY-MM-DDTHH") from an ISO timestamp that is already
 * expressed in Eastern local time — either bare (Open-Meteo "…T14:00") or with
 * an explicit ET offset (NWS "…T14:00:00-04:00"). Both share the YYYY-MM-DDTHH
 * prefix for the same hour, so a simple slice is correct and DST-safe (the
 * offset suffix, which changes across DST, is in the part we discard).
 */
export function etHourKeyFromIso(iso: string): string {
  return iso.slice(0, 13);
}

/**
 * ET calendar-hour key for a given instant (defaults to now). Uses Intl with
 * timeZone America/New_York so it is correct under both EST and EDT regardless
 * of the server's own timezone (Workers runs in UTC).
 */
export function etHourKeyFromDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  // en-CA renders midnight as "24" in some ICU builds; normalize to "00".
  let hh = get('hour');
  if (hh === '24') hh = '00';
  return `${get('year')}-${get('month')}-${get('day')}T${hh}`;
}

/**
 * Pick the entry from an ET-local hourly series whose calendar hour matches
 * `nowKey`. Returns null when no entry matches (e.g. a stale snapshot whose
 * hours are all from a previous day — the date is part of the key, so a
 * wrong-day entry will never false-match). Callers should fall back to a
 * correctly-anchored source (e.g. NWS periods[0]) on null.
 */
export function pickHourByKey<T extends { time: string }>(
  hours: readonly T[],
  nowKey: string,
): T | null {
  return hours.find((h) => etHourKeyFromIso(h.time) === nowKey) ?? null;
}

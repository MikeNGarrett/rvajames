/**
 * Forecast window + chip labels — sub-goal 74.
 *
 * Single source of truth for the 4-chip date picker. Pure computation; no
 * DB query needed. The picker window is always "today (Richmond time) through
 * today + 3 days." Past dates are intentionally excluded.
 *
 * Confidence model (based on NOAA AHPS hydrologic forecast accuracy):
 *   daysOut 0  → null         (observed, not forecast)
 *   daysOut 1  → 'high'
 *   daysOut 2  → 'medium'
 *   daysOut 3  → 'low'
 */

import { formatRichmondDate, addDaysToIso } from '@/lib/utils/date-tz';

export type DateMode = 'observed' | 'forecast';

export interface ForecastChip {
  /** 'YYYY-MM-DD' in Richmond time */
  iso: string;
  /** 'Today' | 'Mon, May 25' | 'Tue, May 26' | 'Wed, May 27' */
  label: string;
  /** 'Today' | 'Mon' | 'Tue' | 'Wed' (for narrow screens) */
  shortLabel: string;
  mode: DateMode;
  /** 0..3 — number of calendar days from today */
  daysOut: number;
  /** null for observed; high/medium/low for forecast days +1/+2/+3 */
  forecastConfidence: 'high' | 'medium' | 'low' | null;
}

/** Format an ISO date string ('YYYY-MM-DD') as 'Mon, May 25'. */
function formatChipLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  // Parse as UTC midnight so DST never shifts the display date
  const d = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Format an ISO date string ('YYYY-MM-DD') as 'Mon'. */
function formatShortLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    weekday:  'short',
    timeZone: 'UTC',
  }).format(d);
}

const CONFIDENCE: Array<'high' | 'medium' | 'low' | null> = [
  null,     // daysOut 0 — observed
  'high',   // daysOut 1
  'medium', // daysOut 2
  'low',    // daysOut 3
];

/**
 * Returns exactly 4 forecast chips: today + 3 forward days.
 *
 * Accepts an optional `now` argument for testing (defaults to `new Date()`).
 */
export function getForecastWindow(now: Date = new Date()): ForecastChip[] {
  const todayIso = formatRichmondDate(now);

  return [0, 1, 2, 3].map((daysOut) => {
    const iso               = addDaysToIso(todayIso, daysOut);
    const mode: DateMode    = daysOut === 0 ? 'observed' : 'forecast';
    const forecastConfidence = CONFIDENCE[daysOut];

    const label      = daysOut === 0 ? 'Today' : formatChipLabel(iso);
    const shortLabel = daysOut === 0 ? 'Today' : formatShortLabel(iso);

    return { iso, label, shortLabel, mode, daysOut, forecastConfidence };
  });
}

/**
 * Returns true when `iso` ('YYYY-MM-DD') falls within today..today+3 in
 * Richmond time. Used by server-side URL guards to reject out-of-window dates.
 *
 * Accepts an optional `now` argument for testing.
 */
export function isInWindow(iso: string, now: Date = new Date()): boolean {
  const todayIso = formatRichmondDate(now);
  const maxIso   = addDaysToIso(todayIso, 3);
  return iso >= todayIso && iso <= maxIso;
}

/**
 * Resolves mode, daysOut, and forecastConfidence for any ISO date string.
 * Derives all three from the date so callers don't have to compute them manually.
 *
 * Used internally by getLocationDetail and getMetroSummary to thread
 * forecast-awareness into AI prompt inputs without changing public API signatures.
 */
export function resolveDateMode(
  iso: string,
  now: Date = new Date(),
): Pick<ForecastChip, 'mode' | 'daysOut' | 'forecastConfidence'> {
  const todayIso = formatRichmondDate(now);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = iso.split('-').map(Number);
  const rawDaysOut = Math.round(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
  const daysOut = Math.max(0, rawDaysOut);
  const mode: DateMode = daysOut === 0 ? 'observed' : 'forecast';
  // Clamp to [0, 3] for the confidence lookup; beyond-window dates use 'low'.
  const confidenceIdx = Math.min(daysOut, 3);
  const forecastConfidence = CONFIDENCE[confidenceIdx] ?? null;
  return { mode, daysOut, forecastConfidence };
}

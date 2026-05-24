/**
 * Richmond timezone helpers.
 *
 * All user-facing date logic for rva-james is anchored to America/New_York
 * (Eastern Time, observes DST). These utilities ensure "today" means the
 * current calendar date in Richmond, not the server's UTC date.
 */

const RICHMOND_TZ = 'America/New_York';

/**
 * Returns the current calendar date in Richmond time as a 'YYYY-MM-DD' string.
 *
 * Example: at 2026-05-25T02:30:00Z (UTC), Richmond is still 2026-05-24 at
 * 10:30 PM EDT — this returns '2026-05-24', not '2026-05-25'.
 */
export function formatRichmondDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RICHMOND_TZ,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
  }).formatToParts(date);

  const year  = parts.find((p) => p.type === 'year')?.value  ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day   = parts.find((p) => p.type === 'day')?.value   ?? '';
  return `${year}-${month}-${day}`;
}

/**
 * Adds `days` calendar days to a 'YYYY-MM-DD' iso string.
 * Operates on the date value only (no timezone conversion) — safe for
 * both DST-aware and DST-naive contexts.
 */
export function addDaysToIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  // Use UTC to avoid DST shifting the day boundary
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y  = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

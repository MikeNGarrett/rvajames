/**
 * USGS Daily Statistics ingest — sub-goal 35.
 *
 * Fetches historical daily-percentile stats (p10/p25/p50/p75/p90) from the
 * USGS RDB statistics service and upserts them into `usgs_percentiles`.
 *
 * USGS endpoint: https://waterservices.usgs.gov/nwis/stat/?sites={site}&format=rdb
 * Returns tab-delimited rows, one per (site, parameter, month, day) combination.
 *
 * Note for 02037500: the stats service only publishes approved data for
 * discharge (parameterCd 00060). Gage-height (00065) rows are absent.
 */

import { createServerClient } from '@/lib/supabase/server';
import type { RunResult } from './run';

/** Stations to fetch percentile stats for. Extend when new gauges are added. */
const STATIONS = ['02037500'];

/**
 * Convert (month, day) to 1-based day-of-year using a fixed non-leap year.
 *
 * Feb 29 MUST be handled explicitly: passing it to `new Date(2001, 1, 29)`
 * (2001 = non-leap year) causes JavaScript to overflow to March 1, which returns
 * day 60 — the same value as the real March 1 entry. Two rows in the same upsert
 * batch with the same (station_id, parameter_cd, day_of_year) trigger Postgres:
 * "ON CONFLICT DO UPDATE command cannot affect row a second time".
 *
 * Fix: assign Feb 29 its natural leap-year slot, day 366. No other calendar date
 * in a 365-day year produces 366, so there is no collision.
 */
function dayOfYear(month: number, day: number): number {
  if (month === 2 && day === 29) return 366; // leap-day slot — avoids March 1 collision
  const d = new Date(2001, month - 1, day);  // 2001 = non-leap year (safe for all other dates)
  const start = new Date(2001, 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Parse numeric column; returns null if absent or not a number. */
function numOrNull(s: string | undefined): number | null {
  if (!s || s.trim() === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Fetch and parse the USGS RDB stat response for one station. */
async function fetchPercentilesRdb(
  stationId: string,
): Promise<Array<{
  parameter_cd: string;
  month_nu: number;
  day_nu: number;
  day_of_year: number;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  record_count: number | null;
}>> {
  const url =
    `https://waterservices.usgs.gov/nwis/stat/?sites=${stationId}&format=rdb`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'RVAJames/1.0 (rvajames.org; river safety app)' },
    // 30-second timeout guard
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`USGS stat HTTP ${res.status} for station ${stationId}`);
  }

  const text = await res.text();
  const lines = text.split('\n');

  // Skip comment lines (#) and the two header rows (column-name + type row)
  const dataLines: string[] = [];
  let headerParsed = false;
  let columnNames: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    if (!headerParsed) {
      // First non-comment line = column names
      columnNames = line.split('\t');
      headerParsed = true;
      continue;
    }

    // Second non-comment line = type codes (5s, 15s, …) — skip it
    if (dataLines.length === 0 && !line.startsWith('USGS')) continue;

    dataLines.push(line);
  }

  if (columnNames.length === 0) {
    throw new Error(`USGS stat: no column headers found for station ${stationId}`);
  }

  const idx = (name: string) => columnNames.indexOf(name);

  return dataLines.map((line) => {
    const cols = line.split('\t');
    const get = (name: string) => cols[idx(name)];

    const month = parseInt(get('month_nu') ?? '', 10);
    const day   = parseInt(get('day_nu')   ?? '', 10);

    return {
      parameter_cd: get('parameter_cd') ?? '',
      month_nu:     month,
      day_nu:       day,
      day_of_year:  dayOfYear(month, day),
      p10:          numOrNull(get('p10_va')),
      p25:          numOrNull(get('p25_va')),
      p50:          numOrNull(get('p50_va')),
      p75:          numOrNull(get('p75_va')),
      p90:          numOrNull(get('p90_va')),
      record_count: numOrNull(get('count_nu')),
    };
  }).filter(
    (r) => r.parameter_cd && !isNaN(r.month_nu) && !isNaN(r.day_nu),
  );
}

export async function runUsgsPercentilesIngestion(): Promise<RunResult> {
  const supabase = await createServerClient('service');
  let rowsWritten = 0;

  for (const stationId of STATIONS) {
    let rows;
    try {
      rows = await fetchPercentilesRdb(stationId);
    } catch (err) {
      return {
        ok: false,
        rowsWritten,
        error: `Failed to fetch USGS stats for ${stationId}: ${String(err)}`,
      };
    }

    if (rows.length === 0) {
      console.warn(`[usgs-percentiles] No data rows returned for station ${stationId}`);
      continue;
    }

    // Deduplicate by conflict key before batching. USGS may include both a
    // Feb 29 row and a March 1 row; after dayOfYear() they should now have
    // distinct values (366 vs 60), but this guard catches any future collisions
    // that would otherwise cause "ON CONFLICT DO UPDATE … affect row a second time".
    const seen = new Set<string>();
    const dedupedRows = rows.filter((r) => {
      const key = `${r.parameter_cd}|${r.day_of_year}`;
      if (seen.has(key)) {
        console.warn(`[usgs-percentiles] Dropping duplicate key: station=${stationId} ${key}`);
        return false;
      }
      seen.add(key);
      return true;
    });

    // Upsert in batches of 200 to stay within Supabase payload limits.
    const BATCH = 200;
    for (let i = 0; i < dedupedRows.length; i += BATCH) {
      const batch = dedupedRows.slice(i, i + BATCH).map((r) => ({
        station_id:   stationId,
        parameter_cd: r.parameter_cd,
        day_of_year:  r.day_of_year,
        month_nu:     r.month_nu,
        day_nu:       r.day_nu,
        p10:          r.p10,
        p25:          r.p25,
        p50:          r.p50,
        p75:          r.p75,
        p90:          r.p90,
        record_count: r.record_count,
        fetched_at:   new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('usgs_percentiles')
        .upsert(batch, { onConflict: 'station_id,parameter_cd,day_of_year' });

      if (error) {
        return {
          ok: false,
          rowsWritten,
          error: `Upsert failed at batch ${i / BATCH}: ${error.message}`,
        };
      }

      rowsWritten += batch.length;
    }

    console.log(`[usgs-percentiles] ${stationId}: wrote ${rowsWritten} rows (${dedupedRows.length} after dedup from ${rows.length} raw)`);
  }

  return { ok: true, rowsWritten };
}

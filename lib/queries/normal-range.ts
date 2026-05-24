/**
 * Query helper for USGS historical percentile data — sub-goal 35.
 *
 * Returns the p10/p25/p50/p75/p90 values for the given station, parameter,
 * and calendar date (day-of-year match). Returns null if no row exists.
 */

import { createServerClient } from '@/lib/supabase/server';

export interface NormalRange {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  parameterCd: string;
  /** Discharge (cfs) when parameterCd='00060'; gage height (ft) when '00065' */
  unit: 'cfs' | 'ft' | 'unknown';
}

function unitForParam(parameterCd: string): NormalRange['unit'] {
  if (parameterCd === '00060') return 'cfs';
  if (parameterCd === '00065') return 'ft';
  return 'unknown';
}

/**
 * Compute 1-based day-of-year from a Date (using the same fixed-year logic
 * as the ingest layer so the lookup always matches).
 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Returns historical daily percentiles for the given station + parameter on
 * the day-of-year matching `date`. Returns null if the row doesn't exist yet
 * (e.g., before the first cron run).
 */
export async function getNormalRange(
  stationId: string,
  parameterCd: string,
  date: Date,
): Promise<NormalRange | null> {
  const supabase = await createServerClient('anon');
  const doy = dayOfYear(date);

  const { data, error } = await supabase
    .from('usgs_percentiles')
    .select('p10, p25, p50, p75, p90, parameter_cd')
    .eq('station_id', stationId)
    .eq('parameter_cd', parameterCd)
    .eq('day_of_year', doy)
    .single();

  if (error || !data) return null;
  if (
    data.p10 == null ||
    data.p25 == null ||
    data.p50 == null ||
    data.p75 == null ||
    data.p90 == null
  ) {
    return null;
  }

  return {
    p10: data.p10,
    p25: data.p25,
    p50: data.p50,
    p75: data.p75,
    p90: data.p90,
    parameterCd: data.parameter_cd,
    unit: unitForParam(data.parameter_cd),
  };
}

/**
 * Convenience: returns the discharge (00060) normal range for the Westham gauge.
 * Falls back to null if the percentile table hasn't been populated yet.
 */
export async function getWesthamDischargeNormalRange(
  date: Date,
): Promise<NormalRange | null> {
  return getNormalRange('02037500', '00060', date);
}

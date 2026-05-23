// Max age in minutes before a source's data is considered stale
export const FRESHNESS_MAX_AGE: Record<string, number> = {
  usgs:      30,
  nws_hourly: 90,
  jra:       26 * 60,
  rva_dpu:   14 * 60,
};

export function isStale(source: string, ageMinutes: number): boolean {
  const max = FRESHNESS_MAX_AGE[source];
  if (max === undefined) return false;
  return ageMinutes > max;
}

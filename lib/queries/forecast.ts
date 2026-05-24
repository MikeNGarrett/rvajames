import { createServerClient } from '@/lib/supabase/server';
import type { NoaaAhpsPayload } from '@/lib/ingest/noaa-ahps';

export type { NoaaAhpsPayload } from '@/lib/ingest/noaa-ahps';

/**
 * Returns the most recent NOAA AHPS forecast snapshot (source='noaa-ahps'),
 * or null if no forecast has been ingested yet.
 *
 * The payload is stored as jsonb and re-typed here — Zod validation is skipped
 * in the read path for speed; the write path (runNoaaAhpsIngestion) is the
 * canonical validation point.
 */
export async function getForecast(): Promise<NoaaAhpsPayload | null> {
  const supabase = await createServerClient('anon');

  const { data } = await supabase
    .from('conditions_snapshots')
    .select('payload, fetched_at')
    .eq('source', 'noaa-ahps')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (!data?.payload) return null;

  // Trust the shape — validated at write time by runNoaaAhpsIngestion.
  return data.payload as unknown as NoaaAhpsPayload;
}

// ── Derived helpers ──────────────────────────────────────────────────────────

export interface ForecastCrossing {
  stage_ft: number;
  at_ms: number;
  label: 'action' | 'flood';
}

/**
 * Returns the first time (if any) the forecast crosses action stage or flood
 * stage within the forecast window. Returns null if the forecast stays below
 * both thresholds, or if no forecast is available.
 */
export function getForecastCrossing(
  forecast: NoaaAhpsPayload | null,
): ForecastCrossing | null {
  if (!forecast || forecast.forecast.length === 0) return null;

  const actionCross = forecast.forecast.find(
    (p) => p.stage_ft >= forecast.action_stage_ft,
  );
  const floodCross = forecast.forecast.find(
    (p) => p.stage_ft >= forecast.flood_stage_ft,
  );

  // Report the more serious one first
  if (floodCross) {
    return { stage_ft: floodCross.stage_ft, at_ms: floodCross.t, label: 'flood' };
  }
  if (actionCross) {
    return { stage_ft: actionCross.stage_ft, at_ms: actionCross.t, label: 'action' };
  }
  return null;
}

/** Peak stage and time within the forecast window */
export function getForecastPeak(
  forecast: NoaaAhpsPayload | null,
): { stage_ft: number; at_ms: number } | null {
  if (!forecast || forecast.forecast.length === 0) return null;
  const peak = forecast.forecast.reduce((a, b) => (b.stage_ft > a.stage_ft ? b : a));
  return { stage_ft: peak.stage_ft, at_ms: peak.t };
}

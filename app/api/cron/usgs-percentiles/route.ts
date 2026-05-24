import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runUsgsPercentilesIngestion } from '@/lib/ingest/usgs-percentiles';

/**
 * Daily cron: refresh USGS historical percentile stats.
 * Runs at 03:00 UTC (see wrangler.jsonc trigger "0 3 * * *").
 * The data changes at most once per day (after USGS approves new daily values),
 * so daily is sufficient. Returns ≥732 upserted rows on first run (366 × 2 params).
 */
export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('usgs-percentiles', runUsgsPercentilesIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

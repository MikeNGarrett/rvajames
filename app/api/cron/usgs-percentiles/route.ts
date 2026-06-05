import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runUsgsPercentilesIngestion } from '@/lib/ingest/usgs-percentiles';
import { runAllClosureSources } from '@/lib/ingest/closures/run-all';

/**
 * Daily cron (0 3 * * *): USGS historical percentiles + all closure sources.
 *
 * Both jobs run once per day. Combined here to stay within the Cloudflare
 * Workers free-plan limit of 5 cron triggers per account.
 *
 * - USGS percentiles: refreshes historical discharge stats (≥732 upserts on
 *   first run; USGS approves new daily values once per day).
 * - Closures: runs all registered closure sources (rva-gov, venture-richmond,
 *   jrps) sequentially. Each source logs a discrete ingestion_runs row.
 *   Creates draft location_status rows for admin review.
 *
 * The standalone /api/cron/rva-closures endpoint remains available for manual
 * triggering without re-running the USGS percentiles job.
 */
export async function GET(request: Request) {
  const denied = await guardCronSecret(request);
  if (denied) return denied;

  // Run both ingestions concurrently — neither depends on the other
  const [percentiles, closures] = await Promise.all([
    withIngestionRun('usgs-percentiles', runUsgsPercentilesIngestion),
    runAllClosureSources(),
  ]);

  const ok = percentiles.ok && closures.ok;
  return NextResponse.json(
    { percentiles, closures },
    { status: ok ? 200 : 500 },
  );
}

import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runUsgsPercentilesIngestion } from '@/lib/ingest/usgs-percentiles';
import { runRvaClosuresIngestion } from '@/lib/ingest/rva-closures';

/**
 * Daily cron (0 3 * * *): USGS historical percentiles + rva.gov closure scrape.
 *
 * Both jobs run once per day. Combined here to stay within the Cloudflare
 * Workers free-plan limit of 5 cron triggers per account.
 *
 * - USGS percentiles: refreshes historical discharge stats (≥732 upserts on
 *   first run; USGS approves new daily values once per day).
 * - RVA closures: scrapes rva.gov/parks-recreation/james-river-park-system for
 *   closure notices and creates draft location_status rows for admin review.
 *
 * The standalone /api/cron/rva-closures endpoint remains available for manual
 * triggering without re-running the USGS percentiles job.
 */
export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  // Run both ingestions in parallel — neither depends on the other
  const [percentiles, rvaClosures] = await Promise.all([
    withIngestionRun('usgs-percentiles', runUsgsPercentilesIngestion),
    withIngestionRun('rva-closures', runRvaClosuresIngestion),
  ]);

  const ok = percentiles.ok && rvaClosures.ok;
  return NextResponse.json(
    { percentiles, rva_closures: rvaClosures },
    { status: ok ? 200 : 500 },
  );
}

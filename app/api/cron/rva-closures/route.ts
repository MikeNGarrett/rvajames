import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runRvaClosuresIngestion } from '@/lib/ingest/rva-closures';

/**
 * Standalone manual-trigger endpoint for the rva.gov closure scraper.
 *
 * Scheduled: piggybacked onto /api/cron/usgs-percentiles (0 3 * * *) to stay
 * within the Cloudflare Workers free-plan 5-trigger limit. This endpoint
 * exists so the scraper can be triggered manually without re-running the full
 * USGS percentiles job.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://rvajames.org/api/cron/rva-closures
 */
export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('rva-closures', runRvaClosuresIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

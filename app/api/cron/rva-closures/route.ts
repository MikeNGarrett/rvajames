import { NextResponse } from 'next/server';
import { guardCronSecret } from '@/lib/ingest/run';
import { runAllClosureSources } from '@/lib/ingest/closures/run-all';

/**
 * Standalone manual-trigger endpoint for all closure sources.
 *
 * Runs rva-gov, venture-richmond, and jrps sources sequentially via the
 * closure source registry. Each source logs a discrete ingestion_runs row.
 *
 * Scheduled: piggybacked onto /api/cron/usgs-percentiles (0 3 * * *) to stay
 * within the Cloudflare Workers free-plan 5-trigger limit. This endpoint
 * exists so the closures scrape can be triggered manually without re-running
 * the full USGS percentiles job.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://rvajames.org/api/cron/rva-closures
 */
export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await runAllClosureSources();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

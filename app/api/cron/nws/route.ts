import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runNwsIngestion } from '@/lib/ingest/nws';
import { runNoaaAhpsIngestion } from '@/lib/ingest/noaa-ahps';

/**
 * Hourly cron (0 * * * *): NWS weather/alerts + NOAA AHPS 72-hour forecast.
 *
 * Both are federal weather/water feeds that update on an hourly cadence.
 * Combined here to stay within the Cloudflare Workers free-plan limit of
 * 5 cron triggers per account. Run in parallel — neither depends on the other.
 *
 * The standalone /api/cron/noaa-ahps route remains available for manual
 * triggering without re-running NWS.
 */
export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  // Run both ingestions in parallel
  const [nws, noaaAhps] = await Promise.all([
    withIngestionRun('nws', runNwsIngestion),
    withIngestionRun('noaa-ahps', runNoaaAhpsIngestion),
  ]);

  const ok = nws.ok && noaaAhps.ok;
  return NextResponse.json({ nws, noaa_ahps: noaaAhps }, { status: ok ? 200 : 500 });
}

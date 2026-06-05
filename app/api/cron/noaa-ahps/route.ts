import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runNoaaAhpsIngestion } from '@/lib/ingest/noaa-ahps';

/**
 * Hourly cron: refresh NOAA AHPS 72-hour forecast for Richmond (RMDV2).
 * Runs at :30 past each hour (see wrangler.jsonc trigger "30 * * * *").
 * Stores one forecast snapshot per run in conditions_snapshots (source='noaa-ahps').
 */
export async function GET(request: Request) {
  const denied = await guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('noaa-ahps', runNoaaAhpsIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

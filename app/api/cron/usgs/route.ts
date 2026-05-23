import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runUsgsIngestion } from '@/lib/ingest/usgs';

export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('usgs', runUsgsIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

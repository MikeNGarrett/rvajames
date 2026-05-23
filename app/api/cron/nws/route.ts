import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runNwsIngestion } from '@/lib/ingest/nws';

export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('nws', runNwsIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runJraIngestion } from '@/lib/ingest/jra';

export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('jra', runJraIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

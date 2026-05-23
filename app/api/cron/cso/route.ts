import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runCsoIngestion } from '@/lib/ingest/cso';

export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  const result = await withIngestionRun('cso', runCsoIngestion);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

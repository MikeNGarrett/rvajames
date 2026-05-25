import { NextResponse } from 'next/server';
import { guardCronSecret, withIngestionRun } from '@/lib/ingest/run';
import { runJraIngestion } from '@/lib/ingest/jra';
import { deriveWaterQualityAdvisories } from '@/lib/ingest/derive-water-quality-advisories';

export async function GET(request: Request) {
  const denied = guardCronSecret(request);
  if (denied) return denied;

  // Step 1: ingest readings from ArcGIS FeatureServer
  const ingestResult = await withIngestionRun('jra', runJraIngestion);

  // Step 2: derive water quality advisories from new readings
  // Run even if ingest wrote 0 rows — existing readings may still need advisories.
  const advisoryResult = await deriveWaterQualityAdvisories();

  const ok = ingestResult.ok && advisoryResult.ok;
  return NextResponse.json(
    {
      ...ingestResult,
      advisoriesWritten: advisoryResult.rowsWritten,
      advisoryError:     advisoryResult.error ?? null,
    },
    { status: ok ? 200 : 500 },
  );
}

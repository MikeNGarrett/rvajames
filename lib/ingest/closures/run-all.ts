/**
 * Runs all registered closure sources in sequence.
 *
 * Each source is wrapped in its own withIngestionRun() call so that:
 * - Individual source failures are logged separately in ingestion_runs
 * - One source failing does not prevent the others from running
 * - The aggregated RunResult reflects all sources combined
 *
 * ingestion_runs will show one row per source per day, e.g.:
 *   closures:rva-gov
 *   closures:venture-richmond
 *   closures:jrps
 */

import { withIngestionRun } from '@/lib/ingest/run';
import type { RunResult } from '@/lib/ingest/run';
import { closureSources } from './registry';

export async function runAllClosureSources(): Promise<RunResult> {
  let totalRows = 0;
  const errors: string[] = [];

  for (const source of closureSources) {
    const result = await withIngestionRun(`closures:${source.name}`, source.run);
    totalRows += result.rowsWritten;
    if (!result.ok && result.error) {
      errors.push(`${source.name}: ${result.error}`);
    }
  }

  return {
    ok:          errors.length === 0,
    rowsWritten: totalRows,
    error:       errors.length > 0 ? errors.join('; ') : undefined,
  };
}

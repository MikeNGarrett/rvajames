/**
 * Closure source registry.
 *
 * Each closure source is a module under lib/ingest/closures/sources/ that
 * exports a ClosureSource object. Register new sources here; they are
 * automatically included in the daily runAllClosureSources() call which
 * piggybacks on the usgs-percentiles cron (0 3 * * *).
 *
 * Sources run sequentially — isolated failures don't block later sources.
 */

import type { RunResult } from '@/lib/ingest/run';
import { rvaGovSource } from './sources/rva-gov';
import { ventureRichmondSource } from './sources/venture-richmond';
import { jrpsSource } from './sources/jrps';

export interface ClosureSource {
  /** Short identifier used in ingestion_runs.source = "closures:<name>" */
  name: string;
  run: () => Promise<RunResult>;
}

export const closureSources: ClosureSource[] = [
  rvaGovSource,
  ventureRichmondSource,
  jrpsSource,
];

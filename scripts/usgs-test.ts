// Run with: pnpm tsx scripts/usgs-test.ts
//
// Tests the two-gauge USGS ingestion against the LOCAL Supabase stack only.
//
// This script writes rows to Postgres. To eliminate any risk of pointing at
// production (the previous version of this file loaded .env.local, which holds
// hosted credentials), it:
//
//   1. Does NOT load .env.local — production credentials never enter the process.
//   2. Reads the local Supabase URL + service-role key from `supabase status -o env`.
//   3. Asserts the URL is 127.0.0.1 / localhost before proceeding — refuses to
//      run against anything else as a belt-and-suspenders check.
//   4. Fails fast if `supabase start` isn't running.
//
// Prerequisite: `supabase start` in the repo root.

import { execSync } from 'node:child_process';
import { runUsgsIngestion } from '../lib/ingest/usgs';

interface LocalSupabaseConfig {
  apiUrl: string;
  serviceRoleKey: string;
  anonKey: string;
}

function loadLocalSupabaseConfig(): LocalSupabaseConfig {
  let raw: string;
  try {
    raw = execSync('supabase status -o env', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error: could not run `supabase status -o env`.');
    console.error('       Is the local Supabase stack running? Try: supabase start');
    console.error(`       Underlying error: ${message}`);
    process.exit(1);
  }

  // Parse KEY="value" lines from `supabase status -o env`
  const parsed: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) parsed[match[1]] = match[2];
  }

  const apiUrl = parsed['API_URL'];
  const serviceRoleKey = parsed['SERVICE_ROLE_KEY'];
  const anonKey = parsed['ANON_KEY'];

  if (!apiUrl || !serviceRoleKey || !anonKey) {
    console.error('Error: `supabase status -o env` did not return expected keys.');
    console.error('       Required: API_URL, SERVICE_ROLE_KEY, ANON_KEY');
    console.error('       Got:', Object.keys(parsed).sort().join(', '));
    process.exit(1);
  }

  // Defense in depth — refuse to write anywhere that doesn't look local.
  // `supabase status` should only ever return a 127.0.0.1/localhost URL, but
  // this check guarantees we never silently write to a remote host even if
  // the CLI behavior changes or the parser gets fooled.
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|::1)(:|\/|$)/.test(apiUrl);
  if (!isLocal) {
    console.error(`Error: refusing to run — API_URL "${apiUrl}" is not local.`);
    console.error('       This script writes to Postgres and only operates against local Supabase.');
    process.exit(1);
  }

  return { apiUrl, serviceRoleKey, anonKey };
}

async function main() {
  const cfg = loadLocalSupabaseConfig();

  // Set env BEFORE calling the ingest module. lib/supabase/server.ts reads
  // process.env at call time, not import time, so static imports above are fine.
  process.env.SUPABASE_URL = cfg.apiUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = cfg.serviceRoleKey;
  process.env.SUPABASE_ANON_KEY = cfg.anonKey;
  process.env.NEXT_PUBLIC_SUPABASE_URL = cfg.apiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = cfg.anonKey;

  console.log(`Target: ${cfg.apiUrl} (local Supabase)`);
  console.log('Running two-gauge USGS ingestion test...');
  const result = await runUsgsIngestion();
  console.log('Result:', JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error('FAIL — ingestion returned ok: false');
    process.exit(1);
  }
  if (result.rowsWritten !== 2) {
    console.warn(`WARN — expected rowsWritten: 2, got ${result.rowsWritten}`);
    console.warn('(If > 2, old access-point rows may remain in local DB)');
  } else {
    console.log('✓ PASS — 2 gauge rows written');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

// Run with: pnpm tsx scripts/usgs-test.ts
// Tests the updated two-gauge USGS ingestion against hosted Supabase.
// Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (uses hosted values from .env.local).

import { config } from 'dotenv';
// override: true so .env.local always wins over any pre-existing process.env value
// (e.g. an empty SUPABASE_SERVICE_ROLE_KEY injected by the agent runtime would
// otherwise block the parsed value from being written — dotenv's default is to
// never clobber). See scripts/ai-smoketest.ts for the same pattern.
config({ path: '.env.local', override: true });
import { runUsgsIngestion } from '../lib/ingest/usgs';

async function main() {
  console.log('Running two-gauge USGS ingestion test...');
  const result = await runUsgsIngestion();
  console.log('Result:', JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error('FAIL — ingestion returned ok: false');
    process.exit(1);
  }
  if (result.rowsWritten !== 2) {
    console.warn(`WARN — expected rowsWritten: 2, got ${result.rowsWritten}`);
    console.warn('(If > 2, the Supabase URL may still point to local or old access-point rows remain)');
  } else {
    console.log('✓ PASS — 2 gauge rows written');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

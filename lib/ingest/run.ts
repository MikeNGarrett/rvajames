import { createServerClient } from '@/lib/supabase/server';
import { getCronSecret } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';

export interface RunResult {
  ok: boolean;
  rowsWritten: number;
  error?: string;
}

export async function withIngestionRun(
  source: string,
  fn: () => Promise<RunResult>,
): Promise<RunResult> {
  const supabase = await createServerClient('service');
  const startedAt = new Date().toISOString();

  const { data: run, error: insertError } = await supabase
    .from('ingestion_runs')
    .insert({ source, started_at: startedAt })
    .select('id')
    .single();

  if (insertError) {
    // Log but continue — the actual ingest must run even if audit logging is broken.
    // This surfaces in `wrangler tail` and does not silently swallow the failure (Finding 18).
    console.error('[withIngestionRun] failed to create ingestion_runs row:', insertError.message);
  }

  let result: RunResult;
  try {
    result = await fn();
  } catch (err) {
    result = { ok: false, rowsWritten: 0, error: String(err) };
  }

  if (run) {
    await supabase
      .from('ingestion_runs')
      .update({
        finished_at: new Date().toISOString(),
        ok: result.ok,
        error: result.error ?? null,
        rows_written: result.rowsWritten,
      })
      .eq('id', run.id);
  }

  return result;
}

/**
 * Validate the cron secret header against the configured CRON_SECRET env.
 *
 * Async because env access on Cloudflare Workers goes through the OpenNext
 * request context (`getCronSecret()` in lib/env.ts). Reading
 * `process.env.CRON_SECRET` directly works today via the nodejs_compat
 * polyfill but is fragile — the request-context API is the documented
 * Workers pattern.
 *
 * Returns:
 *   - 500 Response when CRON_SECRET isn't configured
 *   - 401 Response when the provided secret doesn't match
 *   - null when the request is authorized (caller proceeds)
 */
export async function guardCronSecret(request: Request): Promise<Response | null> {
  let secret: string;
  try {
    secret = await getCronSecret();
  } catch {
    return new Response('CRON_SECRET not configured', { status: 500 });
  }
  const header = request.headers.get('x-cron-secret') ?? request.headers.get('authorization');
  const provided = header?.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    // SEC-2: tight per-IP limit on unauthorized cron hits. The scheduled()
    // dispatcher carries the valid secret and never reaches this branch, so
    // real cron triggers are never throttled.
    const limited = await enforceRateLimit(request, 'CRON_RATE_LIMITER');
    return limited ?? new Response('Unauthorized', { status: 401 });
  }
  return null;
}

import { createServerClient } from '@/lib/supabase/server';

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

export function guardCronSecret(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response('CRON_SECRET not configured', { status: 500 });
  const header = request.headers.get('x-cron-secret') ?? request.headers.get('authorization');
  const provided = header?.replace(/^Bearer\s+/i, '');
  if (provided !== secret) return new Response('Unauthorized', { status: 401 });
  return null;
}

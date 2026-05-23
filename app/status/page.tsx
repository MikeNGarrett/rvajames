import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { DisclaimerFooter } from '@/components/legal/DisclaimerFooter';

export const metadata: Metadata = {
  title: 'System Status — RVA James',
  description: 'Last ingestion run per source and daily AI interpretation cost.',
};

export const revalidate = 60;

const SOURCES = ['usgs', 'nws', 'jra', 'cso'] as const;

const SOURCE_LABELS: Record<string, string> = {
  usgs: 'USGS (every 15 min)',
  nws: 'NWS (hourly)',
  jra: 'JRA (daily noon)',
  cso: 'RVA DPU CSO (6 AM, 6 PM)',
};

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function StatusPage() {
  const supabase = await createServerClient('anon');

  // Last run per source
  const runResults = await Promise.all(
    SOURCES.map((source) =>
      supabase
        .from('ingestion_runs')
        .select('started_at, finished_at, ok, error, rows_written')
        .eq('source', source)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => ({ source, run: data })),
    ),
  );

  // Today's AI cost
  const today = new Date().toISOString().split('T')[0];
  const { data: costData } = await supabase
    .from('ai_interpretations')
    .select('cost_usd, tokens_in, tokens_out')
    .eq('date', today);

  const totalCost = (costData ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const totalTokensIn = (costData ?? []).reduce((sum, r) => sum + r.tokens_in, 0);
  const totalTokensOut = (costData ?? []).reduce((sum, r) => sum + r.tokens_out, 0);
  const interpCount = costData?.length ?? 0;

  // Latest interpretation timestamp
  const { data: latestInterp } = await supabase
    .from('ai_interpretations')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="max-w-lg mx-auto px-4 py-5">
      <Link href="/" className="inline-flex items-center text-sm text-rva-blue mb-4 touch-target">
        ← Dashboard
      </Link>

      <h1 className="text-2xl font-extrabold text-text mb-5">System status</h1>

      {/* Ingestion runs */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-3">Data sources</h2>
        <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
          {runResults.map(({ source, run }, i) => (
            <div
              key={source}
              className={`flex items-center gap-3 px-4 py-3 ${i < SOURCES.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span
                className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${
                  !run ? 'bg-border' : run.ok ? 'bg-status-safe' : 'bg-status-danger'
                }`}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{SOURCE_LABELS[source]}</p>
                {run?.error && (
                  <p className="text-xs text-status-danger-fg truncate">{run.error}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-text-secondary">{timeAgo(run?.started_at ?? null)}</p>
                {run && (
                  <p className="text-xs text-text-muted">{run.rows_written} rows</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI cost today */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-3">AI usage today</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-extrabold text-rva-blue">
              ${totalCost.toFixed(4)}
            </p>
            <p className="text-xs text-text-muted">Cost today</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-text">{interpCount}</p>
            <p className="text-xs text-text-muted">Interpretations</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text">{totalTokensIn.toLocaleString()}</p>
            <p className="text-xs text-text-muted">Tokens in</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text">{totalTokensOut.toLocaleString()}</p>
            <p className="text-xs text-text-muted">Tokens out</p>
          </div>
        </div>
        {totalCost > 1 && (
          <div className="mt-2 rounded-lg bg-status-danger-subtle border border-status-danger p-3 text-sm text-status-danger-fg">
            Daily cost exceeds $1.00 — review interpretation volume.
          </div>
        )}
        {latestInterp && (
          <p className="text-xs text-text-muted mt-2">
            Last generated: {timeAgo(latestInterp.created_at)} · lazy on-demand
          </p>
        )}
      </section>

      <DisclaimerFooter />
    </main>
  );
}

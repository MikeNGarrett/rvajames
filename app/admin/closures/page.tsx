import Link from 'next/link';
import { requireAdminEmail } from '@/lib/admin/auth';
import { createServerClient } from '@/lib/supabase/server';
import {
  expireClosure,
  duplicateClosure,
  approveDraft,
  discardDraft,
} from './actions';
import { ConfirmActionButton } from './ConfirmActionButton';

type Row = {
  id: string;
  state: string;
  kind: string;
  affects: string | null;
  reason: string;
  source: string;
  source_url: string | null;
  effective_from: string;
  effective_to: string | null;
  next_review_at: string | null;
  created_at: string;
  locations: { name: string; slug: string } | null;
};

const SCRAPER_SOURCE = 'rva.gov parks scrape';

function KindBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    open:              'bg-status-safe-subtle text-status-safe-fg',
    restricted:        'bg-status-caution-subtle text-status-caution-fg',
    closed:            'bg-status-closed-subtle text-status-closed',
    closed_indefinite: 'bg-status-danger-subtle text-status-danger',
  };
  const labels: Record<string, string> = {
    open:              'Open',
    restricted:        'Restricted',
    closed:            'Closed',
    closed_indefinite: 'Closed ∞',
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[kind] ?? 'bg-surface text-text-muted'}`}
    >
      {labels[kind] ?? kind}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const styles: Record<string, string> = {
    active:  'bg-status-safe-subtle text-status-safe-fg',
    draft:   'bg-status-caution-subtle text-status-caution-fg',
    expired: 'bg-surface text-text-muted',
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[state] ?? 'bg-surface text-text-muted'}`}
    >
      {state}
    </span>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function ClosuresAdminPage() {
  await requireAdminEmail();
  const supabase = await createServerClient('service');

  const { data: rows, error } = await supabase
    .from('location_status')
    .select('*, locations(name, slug)')
    .in('state', ['active', 'draft'])
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="rounded-md bg-status-danger-subtle border border-status-danger/40 px-4 py-3 text-sm text-status-danger">
        Failed to load closures: {error.message}
      </div>
    );
  }

  const closures = (rows ?? []) as unknown as Row[];

  // Sort: drafts first, then active; within each group newest first (already ordered by created_at desc)
  const sorted = [
    ...closures.filter((r) => r.state === 'draft'),
    ...closures.filter((r) => r.state === 'active'),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text">Closures &amp; Access Status</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Manage operational closures and access restrictions for all locations.
          </p>
        </div>
        <Link
          href="/admin/closures/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-rva-navy text-white text-sm font-medium px-4 py-2 hover:bg-rva-blue transition-colors min-h-[2.75rem]"
        >
          + New closure
        </Link>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="rounded-lg border border-border bg-surface-raised px-6 py-10 text-center">
          <p className="text-text-muted text-sm">No active or draft closures.</p>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 hidden sm:table-cell">Effective</th>
                <th className="px-4 py-3 hidden md:table-cell">Source</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((row) => (
                <tr key={row.id} className="hover:bg-surface transition-colors">
                  {/* Location */}
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="font-medium text-text">
                      {row.locations?.name ?? <span className="text-text-muted italic">Unknown</span>}
                    </div>
                    {row.affects && (
                      <div className="text-xs text-text-muted mt-0.5">{row.affects}</div>
                    )}
                    {/* Show truncated scraped text for scraper drafts so reviewer can judge relevance */}
                    {row.state === 'draft' && row.source === SCRAPER_SOURCE && (
                      <div
                        className="text-xs text-text-muted mt-1 line-clamp-2 italic"
                        title={row.reason}
                      >
                        {row.reason}
                      </div>
                    )}
                  </td>

                  {/* Kind */}
                  <td className="px-4 py-3">
                    <KindBadge kind={row.kind} />
                  </td>

                  {/* State */}
                  <td className="px-4 py-3">
                    <StateBadge state={row.state} />
                  </td>

                  {/* Effective dates */}
                  <td className="px-4 py-3 hidden sm:table-cell text-text-secondary">
                    <div>{fmt(row.effective_from)}</div>
                    {row.effective_to ? (
                      <div className="text-xs">→ {fmt(row.effective_to)}</div>
                    ) : (
                      <div className="text-xs text-text-muted">open-ended</div>
                    )}
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3 hidden md:table-cell text-text-secondary max-w-[180px]">
                    <div className="truncate" title={row.source}>{row.source}</div>
                    {row.source_url && (
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-rva-blue hover:underline truncate block mt-0.5"
                        title={row.source_url}
                      >
                        View source ↗
                      </a>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Edit — always available */}
                      <Link
                        href={`/admin/closures/${row.id}`}
                        className="text-xs text-rva-blue hover:underline font-medium"
                      >
                        Edit
                      </Link>

                      {row.state === 'draft' && (
                        <>
                          {/* Approve — scraper drafts get an inline kind selector;
                              manual drafts just promote as-is */}
                          <form
                            action={approveDraft.bind(null, row.id)}
                            className="flex items-center gap-1"
                          >
                            {row.source === SCRAPER_SOURCE && (
                              <select
                                name="kind"
                                defaultValue={row.kind}
                                className="text-xs border border-border rounded px-1 py-0.5 bg-surface text-text"
                                aria-label="Kind override"
                              >
                                <option value="open">Open</option>
                                <option value="restricted">Restricted</option>
                                <option value="closed">Closed</option>
                                <option value="closed_indefinite">Closed ∞</option>
                              </select>
                            )}
                            <button
                              type="submit"
                              className="text-xs text-status-safe-fg hover:underline font-medium"
                            >
                              Approve
                            </button>
                          </form>

                          {/* Discard draft — hard delete; no undo */}
                          <ConfirmActionButton
                            action={discardDraft.bind(null, row.id)}
                            confirmMessage={`Discard this draft for "${row.locations?.name ?? 'unknown location'}"?\n\nThis permanently deletes it with no undo.`}
                            className="text-xs text-status-danger hover:underline font-medium"
                          >
                            Discard
                          </ConfirmActionButton>
                        </>
                      )}

                      {row.state === 'active' && (
                        <>
                          {/* Expire — recoverable, so caution (not danger) variant */}
                          <ConfirmActionButton
                            action={expireClosure.bind(null, row.id)}
                            confirmMessage={`Expire the closure for "${row.locations?.name ?? 'this location'}"?\n\nThis sets effective_to to now and marks it expired. You can re-create it if needed.`}
                            confirmVariant="caution"
                            className="text-xs text-text-muted hover:underline font-medium"
                          >
                            Expire
                          </ConfirmActionButton>

                          {/* Duplicate */}
                          <form action={duplicateClosure.bind(null, row.id)}>
                            <button
                              type="submit"
                              className="text-xs text-text-secondary hover:underline font-medium"
                            >
                              Duplicate
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review reminder */}
      {sorted.some((r) => r.next_review_at) && (
        <div className="rounded-md bg-status-caution-subtle border border-status-caution/40 px-4 py-3 text-sm text-status-caution-fg">
          <strong>Review reminders</strong>
          <ul className="mt-1 space-y-0.5">
            {sorted
              .filter((r) => r.next_review_at && new Date(r.next_review_at) <= new Date())
              .map((r) => (
                <li key={r.id}>
                  {r.locations?.name} — review was due {fmt(r.next_review_at)}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

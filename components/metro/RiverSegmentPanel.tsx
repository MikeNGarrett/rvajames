/**
 * Deterministic — renders instantly without AI.
 * Shows both gauge readings with clear datum labeling.
 */

import type { MetroRiverState } from '@/lib/queries/river-segment';

interface Props {
  metroState: MetroRiverState;
}

function ageLabel(fetchedAt: string | null): string {
  if (!fetchedAt) return '';
  const m = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function RiverSegmentPanel({ metroState }: Props) {
  const { upriver, downriver, lastUpdatedAt } = metroState;

  return (
    <section aria-label="River gauge readings" className="rounded-xl border border-border bg-surface-raised p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
          River conditions
        </h2>
        {lastUpdatedAt && (
          <span className="text-xs text-text-muted">Updated {ageLabel(lastUpdatedAt)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Upriver gauge — primary safety reference */}
        <div>
          <p className="text-xs text-text-muted mb-1">Westham gauge (upriver)</p>
          {upriver.gageFt !== null ? (
            <p className="text-3xl font-extrabold text-rva-blue">
              {upriver.gageFt.toFixed(2)}
              <span className="text-sm font-medium ml-1 text-text-secondary">ft</span>
            </p>
          ) : (
            <p className="text-lg font-medium text-text-muted">—</p>
          )}
          {upriver.dischargeCfs !== null && (
            <p className="text-xs text-text-muted mt-0.5">
              {upriver.dischargeCfs.toLocaleString()} cfs
            </p>
          )}
          {upriver.waterTempF !== null && (
            <p className="text-xs text-text-muted">
              Water {upriver.waterTempF.toFixed(0)}°F
            </p>
          )}
          <p className="text-xs text-text-muted/60 mt-1">USGS 02037500</p>
        </div>

        {/* Downriver tidal station — supplementary */}
        <div>
          <p className="text-xs text-text-muted mb-1">City Locks (tidal)</p>
          {downriver.gageFt !== null ? (
            <p className="text-3xl font-extrabold text-text">
              {downriver.gageFt.toFixed(2)}
              <span className="text-sm font-medium ml-1 text-text-secondary">ft NAVD</span>
            </p>
          ) : (
            <p className="text-lg font-medium text-text-muted">—</p>
          )}
          <p className="text-xs text-text-muted mt-0.5">Tidal elevation</p>
          <p className="text-xs text-text-muted/60 mt-1">USGS 02037705</p>
        </div>
      </div>

      <p className="text-xs text-text-muted/60 mt-3 border-t border-border pt-2">
        Safety thresholds reference the Westham gauge. City Locks reads tidal elevation
        (NAVD 1988) — different datum, not directly comparable.
      </p>
    </section>
  );
}

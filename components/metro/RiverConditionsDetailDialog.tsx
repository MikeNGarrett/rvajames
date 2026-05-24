'use client';

/**
 * RiverConditionsDetailDialog — sub-goal 39.
 *
 * Native <dialog> with:
 *   - closedby="any"   (light-dismiss: click backdrop or press Esc)
 *   - Invoker commands (commandfor/command) for the trigger button
 *   - JS fallback for backdrop-click on Safari (closedby not yet supported)
 *
 * Modern-web-guidance references:
 *   - light-dismiss-a-dialog: use closedby="any", always open with showModal()
 *   - declarative-dialog-popover-control: commandfor + command="show-modal"
 *
 * Accessibility:
 *   - aria-labelledby → dialog title
 *   - Focus moves to dialog on open (native behavior of showModal())
 *   - Returns focus to trigger on close (native behavior)
 *   - Close button at bottom for pointer users
 */

import { useEffect, useRef } from 'react';
import type { MetroRiverState } from '@/lib/queries/river-segment';
import { Sparkline } from '@/components/ui/Sparkline';

// Invoker Commands polyfill — loaded only when native support is absent.
// Baseline since 2025-12-12 (Chrome/Edge 135, Firefox 144, Safari 26.2).
// guide: declarative-dialog-popover-control
if (typeof window !== 'undefined' && !('commandForElement' in HTMLButtonElement.prototype)) {
  import('invokers-polyfill').catch(() => {});
}

interface Props {
  metroState: MetroRiverState;
}

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function RiverConditionsDetailDialog({ metroState }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  /** Fallback backdrop-click for browsers without closedby support (Safari). */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Only install fallback if native closedby is unsupported
    if ('closedBy' in HTMLDialogElement.prototype) return;

    function handleClick(e: MouseEvent) {
      if (e.target !== dialog) return;
      const rect = dialog!.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) dialog!.close();
    }

    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, []);

  const { upriver, downriver, recent72h, normalRange } = metroState;

  return (
    <dialog
      id="river-detail-dialog"
      ref={dialogRef}
      closedby="any"
      aria-labelledby="detail-dialog-title"
      className="
        m-0 max-w-full w-full sm:max-w-lg sm:mx-auto sm:my-8 sm:rounded-xl
        border border-border bg-surface p-0 shadow-xl
        backdrop:bg-black/40
        open:flex open:flex-col
        max-h-[90vh] overflow-y-auto
      "
    >
      {/* ── Title bar ── */}
      <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <h2 id="detail-dialog-title" className="text-base font-semibold text-text">
          River conditions detail
        </h2>
        <button
          commandfor="river-detail-dialog"
          command="close"
          className="text-text-muted hover:text-text p-1 rounded focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:outline-none"
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-4 space-y-6">

        {/* ── Westham upriver section ── */}
        <section aria-label="Westham gauge (upriver)">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Westham Gauge (Upriver)
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-muted">Gage height</dt>
            <dd className="font-medium text-text">
              {upriver.gageFt !== null ? `${upriver.gageFt.toFixed(2)} ft` : '—'}
            </dd>
            <dt className="text-text-muted">Discharge</dt>
            <dd className="font-medium text-text">
              {upriver.dischargeCfs !== null
                ? `${upriver.dischargeCfs.toLocaleString()} cfs`
                : '—'}
            </dd>
            <dt className="text-text-muted">Water temperature</dt>
            <dd className="font-medium text-text">
              {upriver.waterTempF !== null ? `${upriver.waterTempF.toFixed(1)} °F` : '—'}
            </dd>
            <dt className="text-text-muted">Last updated</dt>
            <dd className="font-medium text-text">{formatTs(upriver.fetchedAt)}</dd>
          </dl>

          {/* 72h sparkline */}
          {recent72h.length >= 3 && (
            <div className="mt-3 border border-border/50 rounded-lg p-2">
              <p className="text-xs text-text-muted mb-1" aria-hidden="true">
                72-hour gage height trend
              </p>
              <Sparkline
                points={recent72h}
                normalBand={normalRange ? undefined : undefined}
                height={60}
              />
            </div>
          )}

          {/* Seasonal context */}
          {normalRange && (
            <div className="mt-3 rounded-lg bg-surface-raised border border-border p-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
                Seasonal context (discharge)
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-text-muted">p10</p>
                  <p className="font-semibold text-text">{Math.round(normalRange.p10).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-text-muted">median</p>
                  <p className="font-semibold text-rva-blue">{Math.round(normalRange.p50).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-text-muted">p90</p>
                  <p className="font-semibold text-text">{Math.round(normalRange.p90).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-1">Discharge (cfs) for this day of year — USGS historical stats</p>
            </div>
          )}

          <a
            href={`https://waterdata.usgs.gov/monitoring-location/${upriver.stationId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-rva-blue hover:underline"
          >
            USGS {upriver.stationId} ↗
          </a>
        </section>

        {/* ── City Locks downriver section ── */}
        <section aria-label="City Locks tidal gauge">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            City Locks (Tidal)
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-muted">Tidal elevation</dt>
            <dd className="font-medium text-text">
              {downriver.gageFt !== null ? `${downriver.gageFt.toFixed(2)} ft NAVD` : '—'}
            </dd>
            <dt className="text-text-muted">Last updated</dt>
            <dd className="font-medium text-text">{formatTs(downriver.fetchedAt)}</dd>
          </dl>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            Tidal elevation above NAVD 1988 datum. This reading oscillates with the tide
            (~−2 to +2 ft) and is <strong>not comparable</strong> to the Westham gage
            height (different datum). Useful for detecting tidal backwater influence.
          </p>
          <a
            href={`https://waterdata.usgs.gov/monitoring-location/${downriver.stationId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-rva-blue hover:underline"
          >
            USGS {downriver.stationId} ↗
          </a>
        </section>

        {/* ── Sources & methodology ── */}
        <section aria-label="Sources and methodology">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Sources & Methodology
          </h3>
          <ul className="text-xs text-text-muted space-y-1 leading-relaxed">
            <li>
              <strong>Gage readings:</strong> USGS National Water Information System,
              refreshed every 15 minutes. Westham (02037500) uses arbitrary gage datum;
              City Locks (02037705) uses NAVD 1988.
            </li>
            <li>
              <strong>Safety thresholds:</strong> Deterministic rules engine keyed to
              Westham gage height. Published flood and advisory thresholds from USGS and NWS.
            </li>
            {normalRange && (
              <li>
                <strong>Seasonal percentiles:</strong> USGS daily statistics for station
                02037500, discharge parameter (00060). Computed from approved daily-mean
                records. Percentiles update daily.
              </li>
            )}
            <li>
              <strong>Refresh cadence:</strong> Gage data — 15 min cron.
              Percentile data — daily at 03:00 UTC. Forecasts — hourly.
            </li>
          </ul>
        </section>
      </div>

      {/* ── Close button at bottom ── */}
      <div className="sticky bottom-0 bg-surface border-t border-border px-4 py-3">
        <button
          commandfor="river-detail-dialog"
          command="close"
          className="w-full text-sm font-medium text-text-secondary bg-surface-raised rounded-lg py-2 border border-border hover:bg-surface focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:outline-none"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

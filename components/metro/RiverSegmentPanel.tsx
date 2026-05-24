/**
 * RiverSegmentPanel — sub-goal 38 rewrite.
 *
 * Deterministic — renders instantly without AI. Designed so the gage number
 * is the dominant visible element in the 375 px viewport (LCP target per
 * audit Finding 1). All data is pre-computed in getMetroRiverState().
 *
 * Layout (mobile baseline, 375 px):
 *   Status pill  +  Headline rating
 *   Hero number (3xl)  +  Class badge
 *   TrendArrow / delta label
 *   HorizontalGauge (threshold bands)
 *   Sparkline (72h)
 *   Translation sentence
 *   Secondary stat chips (temp · cfs · rainfall placeholder)
 *   "More detail →" button (opens RiverConditionsDetailDialog)
 */

import type { MetroRiverState } from '@/lib/queries/river-segment';
import { rapidsClass } from '@/lib/safety/rules';
import type { RapidsClassValue } from '@/lib/safety/rules';
import { HorizontalGauge } from '@/components/ui/HorizontalGauge';
import { Sparkline } from '@/components/ui/Sparkline';
import { TrendArrow } from '@/components/ui/TrendArrow';
import { StatusBadge } from '@/components/tiles/StatusBadge';
import { RiverConditionsDetailDialog } from '@/components/metro/RiverConditionsDetailDialog';

interface Props {
  metroState: MetroRiverState;
}

function ageLabel(fetchedAt: string | null): string {
  if (!fetchedAt) return '';
  const m = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const RAPIDS_BADGE_STYLES: Record<RapidsClassValue, string> = {
  'I-II':   'bg-status-safe text-status-safe-fg',
  'II-III': 'bg-status-safe text-status-safe-fg',
  'III-IV': 'bg-status-caution text-status-caution-fg',
  'IV-V':   'bg-status-danger text-status-danger-fg',
};

/** 1-hour-ago reading from the 72h sparkline array */
function oneHourAgoValue(
  recent72h: { t: number; v: number }[],
): number | null {
  const targetMs = Date.now() - 60 * 60 * 1000;
  // Find the point closest to 1 h ago
  let best: { t: number; v: number } | null = null;
  for (const p of recent72h) {
    const diff = Math.abs(p.t - targetMs);
    if (!best || diff < Math.abs(best.t - targetMs)) best = p;
  }
  // Only use it if it's within 15 min of the target
  if (!best || Math.abs(best.t - targetMs) > 15 * 60 * 1000) return null;
  return best.v;
}

export function RiverSegmentPanel({ metroState }: Props) {
  const { upriver, summary, recent72h, lastUpdatedAt } = metroState;

  const classResult = upriver.gageFt !== null ? rapidsClass(upriver.gageFt) : null;
  const valueOneHourAgo = oneHourAgoValue(recent72h);

  // Thresholds for the HorizontalGauge — static bands from thresholds.json
  const gaugeMin = 0;
  const gaugeMax = 12;
  const normalBand = { low: 0, high: 4.0 };   // "normal" = up to normal_max_ft
  const criticalBand = { low: 8.0, high: 12 }; // flood starts at high_max_ft

  const showGauge   = upriver.gageFt !== null;
  const showSpark   = recent72h.length >= 3;

  // Speculation rules — target the 3 best bets slugs for prerender.
  // Emitted as inline JSON in this deterministic Server Component.
  // (Best bets themselves come from MetroSummaryPanel, but we emit the hook
  //  here; the AI panel replaces the script if it has specific slugs.)

  return (
    <section
      aria-labelledby="river-conditions-heading"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
    >
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-3">
        <h2
          id="river-conditions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
        >
          River conditions
        </h2>
        {lastUpdatedAt && (
          <span
            className="text-xs text-text-muted"
            aria-label={`Data updated ${ageLabel(lastUpdatedAt)}`}
            suppressHydrationWarning
          >
            Updated {ageLabel(lastUpdatedAt)}
          </span>
        )}
      </div>

      {/* ── Status pill + headline ── */}
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={summary.status} />
        <span className="text-base font-semibold text-text">{summary.headline}</span>
      </div>

      {/* ── Hero number + class badge + trend ── */}
      {upriver.gageFt !== null ? (
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          {/* LCP candidate: largest text in the viewport */}
          <p className="text-3xl font-extrabold text-rva-blue leading-none">
            {upriver.gageFt.toFixed(2)}
            <span className="text-sm font-medium ml-1 text-text-secondary">ft</span>
          </p>
          {classResult && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${RAPIDS_BADGE_STYLES[classResult.class]}`}
            >
              Class {classResult.class}
            </span>
          )}
        </div>
      ) : (
        <p className="text-lg font-medium text-text-muted mb-1">No reading</p>
      )}

      {/* Trend arrow (sub-hour change) */}
      {upriver.gageFt !== null && (
        <div className="mb-3">
          {summary.deltaLabel ? (
            <span className="text-xs text-text-muted">{summary.deltaLabel}</span>
          ) : null}
          {valueOneHourAgo !== null && (
            <span className="inline-flex items-center gap-1 ml-2">
              <TrendArrow
                currentValue={upriver.gageFt}
                valueOneHourAgo={valueOneHourAgo}
                unit="ft"
                semantics="safety"
              />
            </span>
          )}
        </div>
      )}

      {/* ── Horizontal gauge bar ── */}
      {showGauge && upriver.gageFt !== null && (
        <div className="mb-3">
          <HorizontalGauge
            value={upriver.gageFt}
            min={gaugeMin}
            max={gaugeMax}
            normalBand={normalBand}
            criticalBand={criticalBand}
            ariaLabel={`River level ${upriver.gageFt.toFixed(2)} ft — ${summary.headline}`}
            bandLabels={[
              { value: 0,    label: 'Low' },
              { value: 4.0,  label: 'Elev' },
              { value: 8.0,  label: 'High' },
              { value: 12,   label: 'Flood' },
            ]}
          />
        </div>
      )}

      {/* ── Sparkline (72 h) ── */}
      {showSpark && (
        <div className="mb-3 border border-border/50 rounded-lg px-2 pt-2 pb-1">
          <p className="text-xs text-text-muted mb-1" aria-hidden="true">72h gage trend</p>
          <Sparkline
            points={recent72h}
            normalBand={normalBand}
            height={125}
          />
        </div>
      )}

      {/* ── Translation sentence ── */}
      <p className="text-sm text-text leading-snug mb-3 max-w-prose">{summary.translation}</p>

      {/* ── Secondary stat chips ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-text-muted">
        {upriver.waterTempF !== null && (
          <span>💧 Water {upriver.waterTempF.toFixed(0)}°F</span>
        )}
        {upriver.dischargeCfs !== null && (
          <span>🌊 {upriver.dischargeCfs.toLocaleString()} cfs</span>
        )}
        {classResult && (
          <span>🛶 {classResult.label}</span>
        )}
      </div>

      {/* ── More detail trigger ── */}
      <div className="border-t border-border/50 pt-3">
        <button
          commandfor="river-detail-dialog"
          command="show-modal"
          // Invoker commands: opens the native <dialog> declaratively.
          // Falls back to the JS showModal() polyfill in the dialog component.
          className="text-xs text-rva-blue font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue rounded"
          aria-haspopup="dialog"
        >
          ⓘ More detail →
        </button>
      </div>

      {/* ── Detail modal (light-dismiss, Invoker commands) ── */}
      <RiverConditionsDetailDialog metroState={metroState} />
    </section>
  );
}

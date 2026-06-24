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
import { StatusBadge } from '@/components/tiles/StatusBadge';
import { RiverConditionsDetailDialog } from '@/components/metro/RiverConditionsDetailDialog';
import { RelativeAgeText, ClientTrendArrow } from '@/components/metro/RelativeTime';

interface Props {
  metroState: MetroRiverState;
}

const RAPIDS_BADGE_STYLES: Record<RapidsClassValue, string> = {
  'I-II':   'bg-status-safe text-status-safe-fg',
  'II-III': 'bg-status-safe text-status-safe-fg',
  'III-IV': 'bg-status-caution text-status-caution-fg',
  'IV-V':   'bg-status-danger text-status-danger-fg',
};

export function RiverSegmentPanel({ metroState }: Props) {
  const { upriver, summary, recent72h, lastUpdatedAt } = metroState;

  const classResult = upriver.gageFt !== null ? rapidsClass(upriver.gageFt) : null;

  // Thresholds for the HorizontalGauge — static bands from thresholds.json
  const gaugeMin = 0;
  const gaugeMax = 12;
  const normalBand = { low: 0, high: 4.0 };   // "normal" = up to normal_max_ft
  const criticalBand = { low: 8.0, high: 12 }; // flood starts at high_max_ft

  const showGauge   = upriver.gageFt !== null;
  const showSpark   = recent72h.length >= 3;

  // Best-bet speculation-rules (prefetch/prerender) live in MetroSummaryPanel,
  // injected via the DOM API once the AI best-bets resolve. This deterministic
  // panel emits none.

  return (
    <section
      aria-labelledby="river-conditions-heading"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
      style={{ viewTransitionName: 'river-conditions' }}
    >
      {/* ── Header: title + observed-mode indicator (mirrors MetroSummaryPanel pattern) ── */}
      <h2
        id="river-conditions-heading"
        className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1"
      >
        Today&apos;s river conditions
      </h2>

      {/*
       * Live-observations pill + (i) tooltip — visual parallel to
       * ForecastModeIndicator's "Forecast confidence: high" pill. Native
       * <details>/<summary> so keyboard users can toggle with Enter/Space
       * and screen readers announce the disclosed content inline.
       */}
      <details className="mt-1.5 mb-3">
        <summary className="inline-flex items-center gap-2 min-h-[2.75rem] list-none cursor-pointer select-none rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rva-blue">
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-status-safe-subtle text-status-safe-fg">
            Live observations
          </span>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-text-muted/50 text-[0.625rem] font-bold text-text-muted flex-shrink-0"
            aria-hidden="true"
          >
            i
          </span>
        </summary>
        <p className="mt-2 text-xs text-text-secondary leading-relaxed max-w-prose">
          Real-time gauge readings from the USGS Westham station, refreshed every 15
          minutes.
          {/*
           * Relative age rendered client-only via useEffect (prefix + suffix
           * also conditional). Rendering "Last update 5m ago." inline would
           * cause React #418 — server's `Date.now()` at request time and the
           * browser's `Date.now()` at hydration time produce different strings,
           * and React 19 production builds don't honor `suppressHydrationWarning`
           * for that mismatch reliably.
           */}
          <RelativeAgeText
            timestamp={lastUpdatedAt}
            prefix=" Last update "
            suffix="."
          />
        </p>
      </details>

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

      {/* Trend arrow (sub-hour change) — value-one-hour-ago is computed
          client-side from Date.now() and would otherwise cause React #418. */}
      {upriver.gageFt !== null && (
        <div className="mb-3">
          {summary.deltaLabel ? (
            <span className="text-xs text-text-muted">{summary.deltaLabel}</span>
          ) : null}
          <span className="inline-flex items-center gap-1 ml-2">
            <ClientTrendArrow
              currentValue={upriver.gageFt}
              recent72h={recent72h}
              unit="ft"
              semantics="safety"
            />
          </span>
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

      {/*
       * The water-temp / cfs / rapids-label chip strip was removed in
       * sub-goal 90 — water temp now lives in the Richmond Conditions
       * inline strip above this panel, and the rapids class pill is
       * already shown next to the gauge headline (line ~125). Discharge
       * cfs surfaces in the detail dialog. Keeping this panel focused on
       * the gauge sparkline + translation sentence — the "river state"
       * job — rather than duplicating the at-a-glance stats above.
       */}

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

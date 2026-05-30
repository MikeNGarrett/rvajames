'use client';

/**
 * Four consumer components for the LocationInterpretationProvider context
 * (sub-goal 66). Each subscribes to the shared fetch state and renders the
 * slice of UI that depends on the AI interpretation.
 *
 * Loading-state strategy:
 *   - LocationInterpretationSummary is the *primary* loading surface — it
 *     shows the full skeleton + spinner + status text affordance.
 *   - LocationActivityMatrix / PrepChecklist / Attribution render null while
 *     loading. They appear when data arrives. This avoids staggered skeletons
 *     stacking visually across the page.
 *
 * Filter-change UX (stale-while-revalidate):
 *   - The summary section keeps prior content visible at 60% opacity during
 *     the refetch (via context's `prior` field). Other sections do the same.
 *   - Skeleton only appears on the very first mount with no prior data.
 *
 * Error UX:
 *   - The summary shows the error banner + retry button. Other sections
 *     hide themselves on error rather than each surfacing their own error
 *     state — the user only needs to see + act on the failure once.
 */

import { Spinner } from '@/components/ui/Spinner';
import { SkeletonShimmer } from '@/components/ui/SkeletonShimmer';
import { ForecastModeIndicator } from '@/components/forecast/ForecastModeIndicator';
import { ActivityMatrix } from './ActivityMatrix';
import { PrepChecklist } from '@/components/trip/PrepChecklist';
import { useLocationInterpretation } from './LocationInterpretationProvider';
import type { DateMode } from '@/lib/queries/date-range';

interface SummaryProps {
  mode:               DateMode;
  dateLabel:          string | null;
  forecastConfidence: 'high' | 'medium' | 'low' | null;
}

/**
 * The visually prominent AI narrative section — owns the loading skeleton
 * + spinner + status text for the whole provider scope.
 */
export function LocationInterpretationSummary({
  mode,
  dateLabel,
  forecastConfidence,
}: SummaryProps) {
  const { status, data, prior, message, retry, showStatusText } =
    useLocationInterpretation();

  // ── Initial load: skeleton + shimmer + spinner ─────────────────────────
  if (status === 'loading' && !prior) {
    return (
      <div aria-live="polite" aria-busy="true">
        <SkeletonShimmer>
          <div className="rounded-xl border border-border bg-surface-raised p-4 mb-4 animate-pulse motion-reduce:animate-none min-h-[180px]">
            <div className="h-3 bg-surface rounded w-1/3 mb-3" />
            <div className="h-5 bg-surface rounded w-3/4 mb-3" />
            <div className="space-y-2">
              <div className="h-3 bg-surface rounded w-full" />
              <div className="h-3 bg-surface rounded w-5/6" />
              <div className="h-3 bg-surface rounded w-4/6" />
            </div>
          </div>
        </SkeletonShimmer>
        <div className="flex items-center gap-2 text-text-secondary mt-1 px-1 mb-4">
          <Spinner size={14} label="Loading interpretation" />
          {showStatusText && (
            <span className="text-xs">Generating interpretation…</span>
          )}
        </div>
      </div>
    );
  }

  // ── Refetch with prior: stale-while-revalidate ────────────────────────
  if (status === 'loading' && prior) {
    return (
      <div aria-live="polite" aria-busy="true" className="relative">
        <div className="opacity-60 transition-opacity">
          {renderSummary(prior, mode, dateLabel, forecastConfidence)}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-surface-raised/90 px-2 py-1 shadow-sm text-text-secondary">
          <Spinner size={14} label="Loading interpretation" />
          {showStatusText && (
            <span className="text-xs">Updating…</span>
          )}
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div aria-live="polite">
        {prior && (
          <div className="opacity-60">
            {renderSummary(prior, mode, dateLabel, forecastConfidence)}
          </div>
        )}
        <div
          role="alert"
          className="rounded-xl border border-status-danger/40 bg-status-danger-subtle p-4 mb-4"
        >
          <p className="text-sm font-medium text-text mb-2">
            Couldn&rsquo;t load. {message}
          </p>
          <button
            type="button"
            onClick={retry}
            className="touch-target inline-flex items-center gap-1 rounded-lg bg-rva-blue px-3 text-sm font-semibold text-white hover:bg-rva-blue/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-1"
          >
            Retry <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (!data) return null; // idle, transient

  return (
    <div aria-live="polite" aria-busy="false">
      {renderSummary(data, mode, dateLabel, forecastConfidence)}
    </div>
  );
}

/**
 * Pure render helper for the summary section. Used by both the success
 * path and the stale-while-revalidate / error paths (where it renders the
 * prior data at reduced opacity).
 */
function renderSummary(
  interp:             { headline: string; body_md: string },
  mode:               DateMode,
  dateLabel:          string | null,
  forecastConfidence: 'high' | 'medium' | 'low' | null,
) {
  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4 mb-4">
      <h2 className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">
        {mode === 'forecast' && dateLabel ? `Forecast for ${dateLabel}` : 'Conditions summary'}
      </h2>
      {mode === 'forecast' && (
        <ForecastModeIndicator mode={mode} forecastConfidence={forecastConfidence} />
      )}
      <p className={`text-base font-medium text-text mb-2${mode === 'forecast' ? ' mt-2' : ''}`}>
        {interp.headline}
      </p>
      <p className="text-sm text-text-secondary leading-relaxed">
        {interp.body_md.replace(/[*#`]/g, '')}
      </p>
      <p className="text-xs text-text-muted italic mt-2">
        Use your judgment — conditions can change fast.
      </p>
    </section>
  );
}

/**
 * Activity allow/caution/deny matrix. Reads context; hides itself until
 * data arrives. Stays in place during stale-while-revalidate using prior
 * data so the page doesn't reflow on filter change.
 */
export function LocationActivityMatrix() {
  const { data, prior } = useLocationInterpretation();
  const source = data ?? prior;
  if (!source?.activities?.length) return null;
  return (
    <div className="mb-4">
      <ActivityMatrix
        activities={
          source.activities as {
            slug:   string;
            status: 'safe' | 'caution' | 'deny';
            note:   string;
          }[]
        }
      />
    </div>
  );
}

/**
 * Trip-prep checklist. Renders only when AI data has prep_items.
 */
export function LocationPrepChecklist({ storageKey }: { storageKey: string }) {
  const { data, prior } = useLocationInterpretation();
  const source = data ?? prior;
  if (!source?.prep_items?.length) return null;
  return (
    <div className="mb-4">
      <PrepChecklist items={source.prep_items} storageKey={storageKey} />
    </div>
  );
}

/**
 * Sources / attribution line under the AI content.
 */
export function LocationAttribution() {
  const { data, prior } = useLocationInterpretation();
  const source = data ?? prior;
  if (!source?.attribution?.length) return null;
  return (
    <p className="text-xs text-text-muted mb-4">
      Sources: {source.attribution.join(', ')}
    </p>
  );
}

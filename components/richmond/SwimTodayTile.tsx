/**
 * SwimTodayTile — Richmond Conditions section, primary tile #1.
 *
 * Shows the family's "can we get in the water?" decision as a colored
 * badge + one-line reason. Native <details> lets users tap to see all
 * contributing reasons (e.g., flood AND cold water AND CSO at once).
 *
 * Status color map (matches the project's semantic status tokens):
 *   recommended → safe   (green)
 *   wade        → caution (gold)
 *   avoid       → danger (red)
 *
 * A11y:
 *   - The badge text is the primary announcement (not the color alone).
 *   - <details>/<summary> is natively keyboard + screen-reader accessible.
 *   - Touch target ≥ 44px (touch-target utility on the summary).
 */

import type { SwimTodayResult } from '@/lib/safety/rules';

interface Props {
  result: SwimTodayResult;
  /** Latest water temp in °F; null when unavailable. Surfaced as a secondary stat. */
  waterTempF: number | null;
}

const STATUS_LABEL: Record<SwimTodayResult['status'], string> = {
  recommended: 'Recommended',
  wade:        'Wade only',
  avoid:       'Avoid',
};

const STATUS_TILE: Record<SwimTodayResult['status'], string> = {
  recommended: 'bg-status-safe-subtle border-status-safe',
  wade:        'bg-status-caution-subtle border-status-caution',
  avoid:       'bg-status-danger-subtle border-status-danger/40',
};

const STATUS_BADGE: Record<SwimTodayResult['status'], string> = {
  recommended: 'bg-status-safe text-status-safe-fg',
  wade:        'bg-status-caution text-status-caution-fg',
  avoid:       'bg-status-danger text-status-danger-fg',
};

export function SwimTodayTile({ result, waterTempF }: Props) {
  const hasMore = result.contributingReasons.length > 1;

  return (
    <div
      className={[
        'flex flex-col gap-2 rounded-xl border p-4',
        STATUS_TILE[result.status],
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Swim today
      </p>

      <span
        className={[
          'inline-flex w-fit items-center rounded-full px-3 py-1 text-base font-semibold',
          STATUS_BADGE[result.status],
        ].join(' ')}
      >
        {STATUS_LABEL[result.status]}
      </span>

      {/*
       * Primary reason wrapped in <details>/<summary> when there are more
       * to reveal. summary text is the touch target.
       */}
      {hasMore ? (
        <details className="group">
          <summary className="touch-target cursor-pointer list-none text-sm leading-snug text-text flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 text-[10px] opacity-70 transition-transform group-open:rotate-90"
            >
              ▶
            </span>
            <span className="flex-1">{result.primaryReason}</span>
          </summary>
          <ul className="mt-2 pl-5 space-y-1 text-xs text-text-secondary">
            {result.contributingReasons.slice(1).map((reason, i) => (
              <li key={i}>• {reason}</li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-sm leading-snug text-text">{result.primaryReason}</p>
      )}

      {waterTempF !== null && (
        <p className="text-xs text-text-muted">
          Water {waterTempF.toFixed(0)}°F
        </p>
      )}
    </div>
  );
}

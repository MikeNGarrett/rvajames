'use client';

/**
 * ForecastChipPicker — sub-goal 76
 *
 * Replaces the native <input type="date"> with 4 explicit chips representing
 * the forecast window (today + next 3 days). Clicking a chip immediately
 * updates the URL date param (via nuqs, shallow:false so RSC re-renders)
 * and wraps the update in document.startViewTransition() when available.
 *
 * Layout:
 *   - 2×2 grid on screens < sm (375px phones)
 *   - 4-in-a-row on sm+ (640px+)
 *   - Each chip ≥44px tall (touch target)
 *
 * A11y:
 *   - role="tablist" / role="tab" / aria-selected on each chip
 *   - All chips have tabIndex=0 (individually reachable via Tab)
 *   - focus-visible ring matches site style
 */

import { useTransition } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import type { ForecastChip } from '@/lib/queries/date-range';

const FORECAST_SUBHEAD =
  'Today and the next 3 days. Forecast accuracy decreases beyond tomorrow.';

interface Props {
  chips: ForecastChip[];
}

export function ForecastChipPicker({ chips }: Props) {
  const [{ date: dateParam }, setDateParam] = useQueryStates(
    { date: parseAsString },
    { shallow: false },
  );
  const [isPending, startTransition] = useTransition();

  // When no ?date in URL, default to today (chips[0])
  const activeIso = dateParam ?? chips[0]?.iso ?? '';

  function selectChip(iso: string) {
    const doUpdate = () => {
      startTransition(() => {
        setDateParam({ date: iso });
      });
    };

    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document
    ) {
      (document as Document & { startViewTransition(cb: () => void): unknown })
        .startViewTransition(doUpdate);
    } else {
      doUpdate();
    }
  }

  return (
    <div>
      {/* ── Chip grid ── */}
      <div
        role="tablist"
        aria-label="Select date"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {chips.map((chip) => {
          const isActive = chip.iso === activeIso;
          return (
            <button
              key={chip.iso}
              type="button"
              role="tab"
              aria-selected={isActive}
              // Forecast chips: no override — accessible name = text content ("Tue, May 26\nForecast").
              // Today chip: aria-label="Today" matches visible text. Both pass WCAG 2.5.3.
              aria-label={chip.mode === 'observed' ? chip.label : undefined}
              disabled={isPending}
              onClick={() => selectChip(chip.iso)}
              className={[
                'relative flex flex-col items-center justify-center gap-0.5',
                'min-h-[44px] rounded-xl border px-2 py-2.5 text-sm font-semibold',
                'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-1',
                isActive
                  ? 'bg-rva-blue text-white border-rva-blue shadow-md'
                  : 'bg-surface-raised text-text border-border hover:border-rva-blue/40',
                isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className="leading-tight">{chip.label}</span>
              {chip.mode === 'forecast' && (
                <span
                  className={`text-[10px] uppercase tracking-wide leading-none ${
                    isActive ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  Forecast
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Expectation copy ── */}
      <p className="text-xs text-text-muted mt-2">{FORECAST_SUBHEAD}</p>
    </div>
  );
}

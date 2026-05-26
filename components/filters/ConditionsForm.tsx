'use client';

/**
 * ConditionsForm — sub-goal 76 rewrite.
 *
 * The date input has been replaced by <ForecastChipPicker />, which fires
 * immediately on chip click (no buffering, no Show button needed for dates).
 * The age-bucket select is still buffered — the Show button commits only the
 * age param; the date is managed independently by the chip picker.
 *
 * Earlier findings preserved:
 *   Finding 15 — nuqs setters with shallow:false for RSC re-render
 *   Finding 16 — View Transitions for progressive-enhancement animation
 */

import { useState, useTransition } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import { AGE_BUCKETS, AGE_BUCKET_LABELS, type AgeBucket } from '@/lib/url-state';
import { ForecastChipPicker } from './ForecastChipPicker';
import type { ForecastChip } from '@/lib/queries/date-range';

interface Props {
  /** Current URL values — form initialises from these */
  currentAge: AgeBucket;
  /** Precomputed 4-chip forecast window from the server */
  chips: ForecastChip[];
}

export function ConditionsForm({ currentAge, chips }: Props) {
  // nuqs manages the URL params; shallow:false triggers RSC re-render.
  const [, setParams] = useQueryStates(
    { age: parseAsString },
    { shallow: false },
  );
  const [isPending, startTransition] = useTransition();

  const [localAge, setLocalAge] = useState<AgeBucket>(currentAge);

  const hasChanged = localAge !== currentAge;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanged) return;

    const doUpdate = () => {
      startTransition(() => {
        // Only commit age — date is managed by ForecastChipPicker
        setParams({ age: localAge });
      });
    };

    // Finding 16: progressive-enhancement View Transition.
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
    <div className="mb-5 space-y-3">
      {/* ── Forecast chip picker — fires immediately on click ── */}
      <ForecastChipPicker chips={chips} />

      {/* ── Age bucket + Show button ── */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="age-bucket" className="text-sm font-medium text-text-secondary">
            Youngest child
          </label>
          <select
            id="age-bucket"
            value={localAge}
            onChange={(e) => setLocalAge(e.target.value as AgeBucket)}
            className="touch-target rounded-lg border border-border bg-surface-raised px-3 text-base font-medium text-text focus:outline-none focus:ring-2 focus:ring-rva-blue"
          >
            {AGE_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {AGE_BUCKET_LABELS[bucket]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!hasChanged || isPending}
          className={`touch-target rounded-lg px-4 text-base font-semibold transition-colors shrink-0
            ${hasChanged && !isPending
              ? 'bg-rva-blue text-white hover:bg-rva-blue/90 active:scale-95'
              : 'bg-surface-raised border border-border text-text-muted cursor-not-allowed'
            }`}
          aria-label="Show conditions"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="animate-spin motion-reduce:animate-none h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
              </svg>
              Loading
            </span>
          ) : 'Show'}
        </button>
      </form>
    </div>
  );
}

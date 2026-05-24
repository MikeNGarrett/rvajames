'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AGE_BUCKETS, AGE_BUCKET_LABELS, formatDateParam, type AgeBucket } from '@/lib/url-state';

interface Props {
  /** Current URL values — form initialises from these */
  currentDate: string;   // YYYY-MM-DD
  currentAge: AgeBucket;
}

export function ConditionsForm({ currentDate, currentAge }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [localDate, setLocalDate] = useState(currentDate);
  const [localAge, setLocalAge] = useState<AgeBucket>(currentAge);

  const hasChanged = localDate !== currentDate || localAge !== currentAge;

  const today = new Date();
  const minDate = formatDateParam(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  const maxDate = formatDateParam(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanged) return;
    startTransition(() => {
      router.push(`/?date=${localDate}&age=${localAge}`);
    });
  }

  return (
    /*
     * Mobile (< sm): 2-column grid — both labelled inputs share row 1,
     * the Show button spans both columns on row 2.
     * ≥ sm: single-row flex (original layout) — inputs grow, button is fixed.
     */
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 mb-5 sm:flex sm:items-end">
      {/* Date */}
      <div className="flex flex-col gap-1 sm:flex-1">
        <label htmlFor="date-picker" className="text-sm font-medium text-text-secondary">
          Date
        </label>
        <input
          id="date-picker"
          type="date"
          value={localDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => {
            if (e.target.value) setLocalDate(e.target.value);
          }}
          className="touch-target rounded-lg border border-border bg-surface-raised px-3 text-base font-medium text-text focus:outline-none focus:ring-2 focus:ring-rva-blue"
        />
      </div>

      {/* Age bucket */}
      <div className="flex flex-col gap-1 sm:flex-1">
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

      {/* Submit — full-width on mobile (col-span-2), auto-width in the sm flex row */}
      <button
        type="submit"
        disabled={!hasChanged || isPending}
        className={`col-span-2 touch-target rounded-lg px-4 text-base font-semibold transition-colors sm:flex-shrink-0
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
  );
}

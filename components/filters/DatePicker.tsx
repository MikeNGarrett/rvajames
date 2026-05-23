'use client';

import { useQueryState, parseAsIsoDate } from 'nuqs';
import { formatDateParam } from '@/lib/url-state';

export function DatePicker() {
  const [date, setDate] = useQueryState('date', parseAsIsoDate.withDefault(new Date()));

  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 7);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="date-picker" className="text-sm font-medium text-text-secondary">
        Date
      </label>
      <input
        id="date-picker"
        type="date"
        value={formatDateParam(date)}
        min={formatDateParam(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000))}
        max={formatDateParam(maxDate)}
        onChange={(e) => {
          const d = new Date(e.target.value + 'T12:00:00');
          if (!isNaN(d.getTime())) setDate(d);
        }}
        className="touch-target rounded-lg border border-border bg-surface-raised px-3 text-base font-medium text-text focus:outline-none focus:ring-2 focus:ring-rva-blue"
      />
    </div>
  );
}

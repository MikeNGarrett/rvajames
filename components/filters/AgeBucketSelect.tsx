'use client';

import { useQueryState, parseAsString } from 'nuqs';
import { AGE_BUCKETS, AGE_BUCKET_LABELS, type AgeBucket } from '@/lib/url-state';

export function AgeBucketSelect() {
  const [age, setAge] = useQueryState('age', parseAsString.withDefault('6-9'));

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="age-bucket" className="text-sm font-medium text-text-secondary">
        Youngest child
      </label>
      <select
        id="age-bucket"
        value={age}
        onChange={(e) => setAge(e.target.value)}
        className="touch-target rounded-lg border border-border bg-surface-raised px-3 text-base font-medium text-text focus:outline-none focus:ring-2 focus:ring-rva-blue"
      >
        {AGE_BUCKETS.map((bucket) => (
          <option key={bucket} value={bucket}>
            {AGE_BUCKET_LABELS[bucket as AgeBucket]}
          </option>
        ))}
      </select>
    </div>
  );
}

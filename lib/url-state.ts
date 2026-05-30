import { createSearchParamsCache, parseAsString, parseAsIsoDate } from 'nuqs/server';
import { formatRichmondDate } from '@/lib/utils/date-tz';

export type AgeBucket = '0-2' | '3-5' | '6-9' | '10-13' | '14+' | 'none';

export const AGE_BUCKETS: AgeBucket[] = ['0-2', '3-5', '6-9', '10-13', '14+', 'none'];

export const AGE_BUCKET_LABELS: Record<AgeBucket, string> = {
  '0-2': 'Under 3',
  '3-5': 'Ages 3–5',
  '6-9': 'Ages 6–9',
  '10-13': 'Ages 10–13',
  '14+': 'Ages 14+',
  'none': 'No youngest child',
};

export const searchParamsCache = createSearchParamsCache({
  date: parseAsIsoDate.withDefault(new Date()),
  age: parseAsString.withDefault('6-9'),
});

/**
 * Returns a 'YYYY-MM-DD' string for the given Date in Richmond (Eastern Time).
 *
 * The previous implementation used `.toISOString().split('T')[0]` (UTC date),
 * which produced wrong-day output between ~8pm and midnight ET when UTC had
 * already rolled over. A user opening the site at 11pm EDT on May 30 would
 * see the May 31 forecast labeled as the current "observed" view — the URL
 * defaulted to UTC-today rather than ET-today.
 *
 * Anchor to ET via formatRichmondDate to match the rest of the codebase
 * (cso-emnet ingest, advisory date filters, location queries).
 */
export function formatDateParam(date: Date): string {
  return formatRichmondDate(date);
}

export function isValidAgeBucket(value: string): value is AgeBucket {
  return AGE_BUCKETS.includes(value as AgeBucket);
}

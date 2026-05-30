import { createSearchParamsCache, parseAsString } from 'nuqs/server';
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

/**
 * Cached parser for ?date= and ?age= URL search params.
 *
 * IMPORTANT: `date` intentionally has NO default. The previous implementation
 * used `parseAsIsoDate.withDefault(new Date())`, which evaluated `new Date()`
 * once at module-init time. On Cloudflare Workers — where module init happens
 * on cold start and the instance stays warm for hours — every request reused
 * that stale default date until the Worker restarted.
 *
 * nuqs's `withDefault` accepts a value, not a thunk (see SingleParserBuilder
 * type signature), so we can't defer evaluation at this layer. Call sites
 * substitute `new Date()` per-request instead:
 *
 *   const { date, age } = searchParamsCache.parse(params);
 *   const dateStr = formatDateParam(date ?? new Date());
 */
export const searchParamsCache = createSearchParamsCache({
  // parseAsString keeps the URL value as-is (already a Richmond-time YYYY-MM-DD
  // from the date chips). The previous parseAsIsoDate converted the string to a
  // UTC-midnight Date, which formatRichmondDate then rolled back one ET day —
  // causing each chip to display data for the *previous* date.
  date: parseAsString,
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

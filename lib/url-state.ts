import { createSearchParamsCache, parseAsString, parseAsIsoDate } from 'nuqs/server';

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

export function formatDateParam(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isValidAgeBucket(value: string): value is AgeBucket {
  return AGE_BUCKETS.includes(value as AgeBucket);
}

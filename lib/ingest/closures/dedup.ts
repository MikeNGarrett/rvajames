/**
 * Natural-key dedup helper for closure sources.
 *
 * Before this helper, each source hashed source_url + reason text and
 * compared against the stored reason column. That broke in JRPS because
 * the insert stored `hit.headline || hit.text` while the dedup hash used
 * only `hit.text` — so every cron re-run produced new duplicate drafts.
 *
 * The natural key is `${source_url}::${location_id}`. This is stable across
 * cron runs regardless of how reason text is formatted or which paragraph
 * was selected. One draft per (article URL, location) — period.
 *
 * Usage:
 *   const existingKeys = await loadExistingKeys(supabase, SOURCE_NAME);
 *   if (existingKeys.has(naturalKey(hit.sourceUrl, locationId))) continue;
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Build the string natural key for a (source_url, location_id) pair.
 */
export function naturalKey(sourceUrl: string, locationId: string): string {
  return `${sourceUrl}::${locationId}`;
}

/**
 * Query all existing draft/active rows for a given source and return a Set
 * of natural keys (`${source_url}::${location_id}`). Rows where location_id
 * is null are ignored — they cannot be deduplicated by this key and should
 * be treated as always-insert (legacy edge case).
 */
export async function loadExistingKeys(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  sourceName: string,
): Promise<Set<string>> {
  const { data: existingRows } = await supabase
    .from('location_status')
    .select('source_url, location_id')
    .eq('source', sourceName)
    .in('state', ['draft', 'active']);

  const keys = new Set<string>();
  for (const row of existingRows ?? []) {
    if (row.source_url && row.location_id) {
      keys.add(naturalKey(row.source_url, row.location_id));
    }
  }
  return keys;
}

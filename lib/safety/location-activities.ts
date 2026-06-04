/**
 * computeLocationActivities — produce the ordered, age-filtered list of
 * per-activity verdicts to display on a location tile (or detail page).
 *
 * Inputs:
 *   - locationActivities — rows from the location_activities table joined
 *     against activities, restricted to one location. Each row carries
 *     the activity's slug, name, min_age, plus the per-(location,
 *     activity) min_age_override (e.g. Belle Isle's swim is bumped to
 *     10 even though the global swim min_age is 5).
 *   - ageBucket — youngest family-member bucket from the URL state.
 *     Drives the age filter.
 *   - metroState — current upriver gauge reading. Threaded into the
 *     verdict helpers; null means we lack the data and verdicts default
 *     to safe.
 *   - riverwideVerdicts — output of riverWideActivityStatuses called
 *     ONCE per page (not per location) and reused here. Maps 4 generic
 *     slugs (swimming / rock-hopping / kayaking-whitewater / hiking) to
 *     {status, baseReason}. Slugs that aren't in this set route through
 *     nonRiverwideActivityVerdict.
 *
 * Output: an array of ActivityChip-shaped records ready for the
 * ActivityChipRow component. Caller is responsible for capping the
 * displayed count and sorting; this helper preserves the source order.
 */

import type { AgeBucket } from '@/lib/url-state';
import {
  nonRiverwideActivityVerdict,
  type RiverwideActivityStatus,
} from './rules';

/** Activity row as it appears in the location_activities → activities join. */
export interface JoinedLocationActivity {
  /** From location_activities.min_age_override. NULL when no override. */
  min_age_override: number | null;
  /** Joined activities row (small subset of columns this helper needs). */
  activity: {
    slug: string;
    name: string;
    min_age: number;
  };
}

/** Output shape — matches the ActivityChip type consumed by ActivityChipRow. */
export interface LocationActivityVerdict {
  slug:   string;
  name:   string;
  status: 'safe' | 'caution' | 'deny';
  note:   string;
}

/**
 * Map activity-table slugs to the four river-wide slugs that
 * riverWideActivityStatuses produces. Keep in sync with the seed data
 * + lib/safety/rules.ts.
 */
const RIVERWIDE_SLUG_FOR_ACTIVITY: Record<string, RiverwideActivityStatus['slug']> = {
  'swim':         'swimming',
  'rock-hop':     'rock-hopping',
  'kayak-rapids': 'kayaking-whitewater',
  'hike':         'hiking',
};

/**
 * Highest age within each age bucket. Activities with min_age above
 * this value are filtered out (e.g. swim min_age 10 is hidden for a
 * '6-9' family because the youngest can't safely participate).
 *
 * `none` means no age filter (general audience).
 */
const AGE_BUCKET_MAX: Record<AgeBucket, number> = {
  '0-2':   2,
  '3-5':   5,
  '6-9':   9,
  '10-13': 13,
  '14+':   Number.POSITIVE_INFINITY,
  'none':  Number.POSITIVE_INFINITY,
};

interface Args {
  locationActivities: JoinedLocationActivity[];
  ageBucket:          AgeBucket;
  metroState: {
    gageFt: number | null;
  };
  riverwideVerdicts: RiverwideActivityStatus[];
}

export function computeLocationActivities({
  locationActivities,
  ageBucket,
  metroState,
  riverwideVerdicts,
}: Args): LocationActivityVerdict[] {
  const ageMax = AGE_BUCKET_MAX[ageBucket];

  return locationActivities
    .filter((la) => {
      const effectiveMinAge = la.min_age_override ?? la.activity.min_age;
      return effectiveMinAge <= ageMax;
    })
    .map((la) => {
      const slug = la.activity.slug;
      // Riverwide first.
      const rwSlug = RIVERWIDE_SLUG_FOR_ACTIVITY[slug];
      if (rwSlug !== undefined) {
        const entry = riverwideVerdicts.find((v) => v.slug === rwSlug);
        if (entry) {
          return {
            slug,
            name:   la.activity.name,
            status: entry.status,
            note:   entry.baseReason,
          };
        }
        // Riverwide slug mapped but no verdict — shouldn't happen if
        // riverWideActivityStatuses was called. Fall through to non-RW.
      }
      // Non-riverwide path (wade, fishing, bridge-crossing, etc.).
      const v = nonRiverwideActivityVerdict(slug, { gageFt: metroState.gageFt });
      return {
        slug,
        name:   la.activity.name,
        status: v.status,
        note:   v.baseReason,
      };
    });
}

import { describe, it, expect } from 'vitest';
import {
  computeLocationActivities,
  type JoinedLocationActivity,
} from './location-activities';
import { riverWideActivityStatuses } from './rules';

// Build a JoinedLocationActivity entry for a test fixture.
const la = (
  slug: string,
  name: string,
  min_age: number,
  min_age_override: number | null = null,
): JoinedLocationActivity => ({
  min_age_override,
  activity: { slug, name, min_age },
});

// Real river-wide verdicts at a benign gauge (~3 ft) so the rules pass
// through to safe states for activities that map to riverwide slugs.
const rwSafe = riverWideActivityStatuses({
  upriverGageFt: 3.0,
  waterTempF: 75,
  rain48hIn: 0,
  activeCSOAdvisory: false,
  hasHighSeverityAdvisory: false,
});

// And one at a higher-flow stage so swim/rock-hop escalate.
const rwElevated = riverWideActivityStatuses({
  upriverGageFt: 6.0,
  waterTempF: 65,
  rain48hIn: 0,
  activeCSOAdvisory: false,
  hasHighSeverityAdvisory: false,
});

describe('computeLocationActivities', () => {
  describe('age filtering', () => {
    it('includes activities whose effective min_age fits the youngest age bucket', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('wade', 'Wading', 0),
          la('hike', 'Hiking', 2),
        ],
        ageBucket: '0-2',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result.map((a) => a.slug)).toEqual(['wade', 'hike']);
    });

    it('excludes activities whose effective min_age exceeds the youngest age bucket', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('wade', 'Wading', 0),
          la('swim', 'Swimming', 5),
          la('kayak-rapids', 'Kayaking', 10),
        ],
        ageBucket: '3-5',  // max age 5
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result.map((a) => a.slug)).toEqual(['wade', 'swim']);
      // Kayaking excluded — its min_age 10 > age-bucket max 5
    });

    it('honors min_age_override over the activity\'s default min_age', () => {
      const result = computeLocationActivities({
        locationActivities: [
          // Belle Isle's swim is overridden to 10
          la('swim', 'Swimming', 5, 10),
        ],
        ageBucket: '6-9',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      // 6-9 max is 9, override min is 10 → excluded
      expect(result).toHaveLength(0);
    });

    it('does NOT apply age filter when ageBucket is "none"', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('kayak-rapids', 'Kayaking', 10),
          la('swim', 'Swimming', 5),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result.map((a) => a.slug)).toEqual(['kayak-rapids', 'swim']);
    });

    it('does NOT apply age filter when ageBucket is "14+"', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('kayak-rapids', 'Kayaking', 10),
        ],
        ageBucket: '14+',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('verdict mapping', () => {
    it('maps river-wide activity slugs through riverwideVerdicts', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('swim', 'Swimming', 5),
          la('hike', 'Hiking', 2),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result[0]).toMatchObject({
        slug: 'swim',
        status: 'safe',
      });
      expect(result[1]).toMatchObject({
        slug: 'hike',
        status: 'safe',
      });
    });

    it('escalates swim to caution at elevated stages via the riverwide verdicts', () => {
      const result = computeLocationActivities({
        locationActivities: [la('swim', 'Swimming', 5)],
        ageBucket: 'none',
        metroState: { gageFt: 6.0 },
        riverwideVerdicts: rwElevated,
      });
      expect(result[0].status).not.toBe('safe');
    });

    it('routes non-riverwide slugs through nonRiverwideActivityVerdict', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('wade', 'Wading', 0),
          la('fishing', 'Fishing', 4),
          la('bird-watching', 'Bird Watching', 0),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      // None of these have specific gauge logic → all safe with check-site note
      for (const a of result) {
        expect(a.status).toBe('safe');
        expect(a.note).toMatch(/check site/i);
      }
    });

    it('denies bridge-crossing above the gage_deny_above_ft threshold (13 ft Westham, Florence precedent)', () => {
      // Bridge_crossing.gage_deny_above_ft is 13 per thresholds.json
      const result = computeLocationActivities({
        locationActivities: [
          la('bridge-crossing', 'Potterfield Bridge', 3),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 14.0 }, // above the deny threshold
        riverwideVerdicts: [],
      });
      expect(result[0].status).toBe('deny');
      expect(result[0].note).toMatch(/bridge may be closed/i);
    });

    it('keeps bridge-crossing safe below the threshold', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('belle-isle-pedestrian', 'Belle Isle Bridge', 3),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 6.0 },
        riverwideVerdicts: [],
      });
      expect(result[0].status).toBe('safe');
    });

    it('denies beach-access above the gage_deny_above_ft threshold (8 ft)', () => {
      const result = computeLocationActivities({
        locationActivities: [la('beach-access', 'Beach', 0)],
        ageBucket: 'none',
        metroState: { gageFt: 9.0 },
        riverwideVerdicts: [],
      });
      expect(result[0].status).toBe('deny');
      expect(result[0].note).toMatch(/beach access submerged/i);
    });

    it('handles a null gauge gracefully — non-riverwide slugs default to safe', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('bridge-crossing', 'Bridge', 3),
          la('beach-access', 'Beach', 0),
        ],
        ageBucket: 'none',
        metroState: { gageFt: null },
        riverwideVerdicts: [],
      });
      expect(result.every((a) => a.status === 'safe')).toBe(true);
    });
  });

  describe('output shape', () => {
    it('preserves source order', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('hike', 'Hiking', 2),
          la('wade', 'Wading', 0),
          la('fishing', 'Fishing', 4),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result.map((a) => a.slug)).toEqual(['hike', 'wade', 'fishing']);
    });

    it('passes through activity name verbatim', () => {
      const result = computeLocationActivities({
        locationActivities: [
          la('belle-isle-pedestrian', 'Belle Isle Pedestrian Bridge', 3),
        ],
        ageBucket: 'none',
        metroState: { gageFt: 3.0 },
        riverwideVerdicts: rwSafe,
      });
      expect(result[0].name).toBe('Belle Isle Pedestrian Bridge');
    });
  });
});

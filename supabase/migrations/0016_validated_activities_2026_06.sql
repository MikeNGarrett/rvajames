-- Validated activity matrix + per-location publish flag (Richmond 91 follow-up)
--
-- Source: deep-research workflow run 2026-06-02 (105 agents, 23 sources,
-- adversarial verification). Full report: docs/jrps-research-2026-06-02.md.
--
-- This migration:
--   1. Adds 6 new activity slugs (wade, rock-climbing, fishing, snorkeling,
--      tubing, bird-watching) to the activities table — observed in the
--      official JRPS activity inventory but missing from the original seed.
--   2. Adds a per-(location, activity) min-age override so Belle Isle's
--      swim can be raised to 10+ without affecting other locations' swim.
--   3. Adds a `published` flag on locations for excluding from public-
--      facing queries without losing the row's historical data (advisories,
--      water-quality readings, closures, AI interpretations, etc.).
--   4. Unpublishes Mayo Island — the Capital Region Land Conservancy
--      acquired it in 2022 for future public-park development; current
--      access is limited and the dashboard should not surface it.
--   5. Rewrites the location_activities matrix for the 8 published
--      locations per the validated research. Notable corrections:
--        - Belle Isle: REMOVE swim from base set (now only with override
--          min_age 10 + PFD overlay); REMOVE bridge-crossing (that's
--          Potterfield, which doesn't connect to Belle Isle); ADD wade,
--          rock-climbing, fishing, bird-watching.
--        - Pony Pasture: ADD wade, fishing, snorkeling, tubing,
--          bird-watching.
--        - Texas Beach: ADD wade.
--        - Pump House: REMOVE swim and beach-access (cove access is via
--          Friends of Pump House monthly guided tours only; park trails
--          remain open via hike).
--
-- The Mayo Island row is preserved (UPDATE published=false rather than
-- DELETE) so any historical ingest data tied to it remains queryable, and
-- re-publishing later is a single UPDATE rather than a re-seed.

BEGIN;

-- ─── New activity slugs ─────────────────────────────────────────────────────
INSERT INTO activities (slug, name, min_age, requires_swim, surface_type) VALUES
  ('wade',          'Wading',                0, false, 'water'),
  ('rock-climbing', 'Rock Climbing',        10, false, 'rock'),
  ('fishing',       'Fishing',               4, false, 'water'),
  ('snorkeling',    'Snorkeling',            8, true,  'water'),
  ('tubing',        'Tubing',                6, true,  'water'),
  ('bird-watching', 'Bird Watching',         0, false, 'mixed')
ON CONFLICT (slug) DO NOTHING;

-- ─── Per-(location, activity) min-age override ──────────────────────────────
-- Used today for Belle Isle's swim (10+, PFD-required overlay). NULL means
-- "use activities.min_age". Future locations can override any activity.
ALTER TABLE location_activities
  ADD COLUMN IF NOT EXISTS min_age_override INTEGER NULL;

-- ─── Publish flag ───────────────────────────────────────────────────────────
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT true;

UPDATE locations SET published = false WHERE slug = 'mayo-island';

-- ─── Rebuild location_activities for the 8 published locations ──────────────
-- Wipe only the matrix rows for these locations; preserve all other rows
-- (including Mayo Island's, in case we re-publish later).
DELETE FROM location_activities
WHERE location_id IN (
  SELECT id FROM locations
  WHERE slug IN (
    'belle-isle', 'pony-pasture', 'texas-beach', 'browns-island',
    'shiplock-trail', 'north-bank-trail', 'buttermilk-trail', 'pump-house'
  )
);

-- Belle Isle — swim is age-gated at 10 here (PFD overlay handled in UI)
INSERT INTO location_activities (location_id, activity_id, min_age_override)
SELECT l.id, a.id, CASE WHEN a.slug = 'swim' THEN 10 ELSE NULL END
FROM locations l, activities a
WHERE l.slug = 'belle-isle'
  AND a.slug IN (
    'wade', 'swim', 'rock-hop', 'belle-isle-pedestrian', 'beach-access',
    'hike', 'rock-climbing', 'fishing', 'bird-watching'
  );

-- Pony Pasture — most family-friendly access; Class II rapids
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'pony-pasture'
  AND a.slug IN (
    'wade', 'swim', 'rock-hop', 'beach-access', 'hike',
    'fishing', 'snorkeling', 'tubing', 'bird-watching'
  );

-- Texas Beach — shallow calm-water swim/wade entry
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'texas-beach'
  AND a.slug IN ('wade', 'swim', 'rock-hop', 'beach-access');

-- Browns Island — downtown lawn + Potterfield bridge to Manchester
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'browns-island'
  AND a.slug IN ('beach-access', 'hike', 'bridge-crossing');

-- Shiplock Trail — Canal Walk East
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'shiplock-trail'
  AND a.slug IN ('hike', 'beach-access');

-- North Bank Trail — advanced 2.5 mi singletrack (yield to bikes)
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'north-bank-trail'
  AND a.slug IN ('hike', 'rock-hop');

-- Buttermilk Trail — hardest JRPS trail
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'buttermilk-trail'
  AND a.slug IN ('hike');

-- Pump House Park — trails open year-round; building access via monthly
-- guided tours (Friends of Pump House); cove swim/beach access not for
-- general public until restoration funded.
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'pump-house'
  AND a.slug IN ('hike');

COMMIT;

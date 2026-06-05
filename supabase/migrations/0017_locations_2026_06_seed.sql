-- Seed 12 additional James River locations + 1 new activity (kayak-flatwater).
--
-- Source: docs/locations-research-2026-06-04.md (three parallel deep-research
-- agents, cited sources for every numeric claim). User decisions captured at
-- the top of that doc — including the Tredegar Rope Swing publish-with-warnings
-- posture (4 documented drownings: 2009 / 2009 / 2011 / April 2026), the
-- substitution of Williams Island Dam Park → /safety dam-hazards section
-- (no such park entity exists in JRPS or municipal records), and the
-- introduction of kayak-flatwater as a distinct activity from kayak-rapids.
--
-- Coordinates marked "provisional" are best-available estimates from the
-- research sources (JRPS Explore pages, RichmondOutside, paddling.com, OSM
-- search). Direct OSM cross-checks pending; pin-perfect coords can be tightened
-- in a future amendment migration without affecting the activity matrix or
-- thresholds.
--
-- This migration does NOT touch the existing 9 published locations or their
-- activity matrices. Existing thresholds and overrides from migration 0016
-- remain intact.

BEGIN;

-- ─── New activity: kayak-flatwater ──────────────────────────────────────────
-- Calm-water paddling (NOT whitewater). USCG under-13 PFD rule applies; AAP
-- "touch supervision" applies for under-5 near any water. Min age 6 reflects
-- the practical floor for sitting still in a kayak with an adult paddler.
-- Surfaces on Huguenot Flatwater (calm pool upstream of the rapids) and
-- Chapel Island (tidal kayak launch downstream of the fall line).
INSERT INTO activities (slug, name, min_age, requires_swim, surface_type) VALUES
  ('kayak-flatwater', 'Kayaking (flatwater)', 6, false, 'water')
ON CONFLICT (slug) DO NOTHING;

-- ─── New locations: 12 sites ────────────────────────────────────────────────
-- All seeded as kind='access_point', published=true. Coordinates are
-- provisional (see note above).
INSERT INTO locations (slug, name, lat, lng, kind, tags, published) VALUES

  -- ─── Cluster A — Trail / pedestrian-only (6) ─────────────────────────────

  -- Canal Walk — paved 5th-to-17th-Street walk along the Haxall + Kanawha
  -- canals. Above floodwall — no Westham-keyed closure; access controlled by
  -- City floodgate operations during flood events.
  ('canal-walk',
   'Riverfront Canal Walk',
   37.534000, -77.440000,
   'access_point',
   ARRAY['canal','paved-trail','downtown','stroller-friendly','accessible'],
   true),

  -- Manchester Floodwall Walk (Floodwall Park) — pedestrian path atop the
  -- south-bank floodwall, ~2.0 mi end-to-end. Above floodplain. Coordinates
  -- centered on the Potterfield Bridge south landing where most visitors
  -- enter the walk.
  ('manchester-floodwall-walk',
   'Floodwall Park (Manchester Floodwall Walk)',
   37.529800, -77.436000,
   'access_point',
   ARRAY['paved-trail','south-bank','floodwall','views','stroller-friendly'],
   true),

  -- Virginia Capital Trail — 52-mi paved multi-use trail Richmond ⇄ Jamestown.
  -- Coordinates pinned to the Richmond mile-zero terminus at Great Shiplock
  -- Park (where bike commuters and families start the western terminus).
  ('virginia-capital-trail',
   'Virginia Capital Trail — Richmond Terminus',
   37.525800, -77.420100,
   'access_point',
   ARRAY['paved-trail','multi-use','long-distance','stroller-friendly','bike'],
   true),

  -- Dock Street Park — small waterfront park east of Mayo Bridge, between the
  -- floodwall and the river. OUTSIDE the floodwall — will flood at much lower
  -- Westham stages than Canal Walk / Floodwall Park (per Cluster A research,
  -- no published threshold; we use a conservative 12 ft Westham flag in
  -- thresholds.json).
  ('dock-street-park',
   'Dock Street Park',
   37.529000, -77.431900,
   'access_point',
   ARRAY['waterfront','small-park','outside-floodwall','river-view'],
   true),

  -- Reedy Creek — JRPS Park HQ meadow node (3315 Riverside Dr area). The
  -- actual hiking trail accessed from here is Buttermilk (already seeded).
  -- Seeded as a separate entity so the meadow + parking + HQ can carry their
  -- own card; flavor copy will route walkers to Buttermilk.
  ('reedy-creek',
   'Reedy Creek (Park HQ Meadow)',
   37.540000, -77.490000,
   'access_point',
   ARRAY['meadow','park-hq','trail-access','parking','quiet'],
   true),

  -- The Wetlands — JRPS Explore-the-Park entity off Landria Dr (3395 Landria).
  -- Quiet wetland trails with parking for ~7. Per the Cluster A research,
  -- this is the only JRPS-named "wetlands" entity with a dedicated official
  -- page (alternates considered: Deepwater Terminal at Ancarrow's, Reedy
  -- Creek wetlands — neither is a JRPS-named trail destination).
  ('the-wetlands',
   'The Wetlands',
   37.537100, -77.480700,
   'access_point',
   ARRAY['wetland','trail','bird-watching','quiet','limited-parking'],
   true),

  -- ─── Cluster B — Boat ramps / water access (3) ───────────────────────────
  --
  -- Note: 14th Street Takeout is intentionally NOT seeded — user decision
  -- 2026-06-05. Expert whitewater EXIT only, not a family destination.
  -- Can be added in a future migration if a paddler-focused page lands.

  -- Tredegar Boat Ramp (Tredegar Street Put-in) — north-bank ramp rebuilt
  -- ~2023 (City + JROC + JRPS), serves Richmond Fire Dept swift-water rescue
  -- AND expert paddlers heading into Hollywood Rapids. SWIMMING EXPLICITLY
  -- NOT PERMITTED at the ramp per JRPS — adjacent JRA-tested "Tredegar Beach"
  -- swim spot is ~50 ft downstream and is NOT modeled here as a swim activity
  -- (cluster-B research recommends one-location-no-swim modeling).
  ('tredegar-boat-ramp',
   'Tredegar Street Put-in (Tredegar Boat Ramp)',
   37.534690, -77.445780,
   'access_point',
   ARRAY['boat-ramp','paddle','rebuilt-2023','rescue-access','expert-paddler'],
   true),

  -- Ancarrow's Landing — only motorized launch in JRPS. BRACKISH/TIDAL zone
  -- (Westham gauge 02037500 does NOT describe local conditions). Primary
  -- gauge wired in thresholds.json is USGS 02037705 (City Locks) with NOAA
  -- 8638495 (Richmond Locks tides) as supplement. NO swim/wade activity —
  -- tidal industrial corridor, no JRA bacteria data. Annual shad run draws
  -- crowds in March-April.
  ('ancarrows-landing',
   'Ancarrow''s Landing',
   37.508300, -77.427200,
   'access_point',
   ARRAY['boat-ramp','tidal','motorized','fishing','slave-trail-terminus','no-swim'],
   true),

  -- Huguenot Flatwater — JRPS calm-water put-in UPSTREAM of the rapids.
  -- Most family-friendly paddle launch in the JRPS system. 2023 ADA ramp.
  -- Hazard: Z-Dam and Bosher's Dam are downstream — drift-down is a real
  -- failure mode; flavor copy carries the warning.
  ('huguenot-flatwater',
   'Huguenot Flatwater',
   37.564500, -77.561400,
   'access_point',
   ARRAY['flatwater','boat-ramp','family-friendly','accessible-launch','ada','swim','jra-tested'],
   true),

  -- ─── Cluster C — Sensitive sites (3) ─────────────────────────────────────

  -- Tredegar Rope Swing — informal swim eddy below the CSX railroad trestle
  -- between Brown's Island and Belle Isle. PUBLISHED with strong framing per
  -- user decision 2026-06-05: min_age 14 override on swim activity, hazard
  -- banner naming 2009 / 2009 / 2011 / April 2026 drownings, automatic close
  -- at Westham gauge ≥ 5 ft. The rope swing itself is NOT a tracked
  -- activity slug — surfaced via flavor + warning copy only. No agency
  -- operates or inspects the rope; CSX has not sanctioned recreational use.
  ('tredegar-rope-swing',
   'Tredegar Rope Swing (informal)',
   37.534500, -77.440000,
   'access_point',
   ARRAY['informal','rope-swing','swim-hazard','no-lifeguard','older-kids','documented-incidents'],
   true),

  -- Manchester Climbing Wall — fully sanctioned JRPS outdoor climbing wall.
  -- 60-ft granite remnant of the 1838 Richmond & Petersburg Railroad Bridge,
  -- ~43 bolted routes 5.4-5.10d. Sunrise-to-sunset every day; bring your own
  -- rope and a belayer. Min age 8 (override on rock-climbing default of 10)
  -- per user decision 2026-06-05 — based on USA Climbing U11 norms and
  -- gym-to-crag industry practice.
  ('manchester-climbing-wall',
   'Manchester Climbing Wall',
   37.529900, -77.436100,
   'access_point',
   ARRAY['climbing','outdoor','sanctioned','south-bank','bring-gear','jrps'],
   true),

  -- Chapel Island — 11-acre island adjacent to Great Shiplock Park via a
  -- 2013 footbridge (City + CSX + Capital Trees + JRPS partnership).
  -- Outside the floodwall (downstream of the floodgate) — conservative 12 ft
  -- Westham flag in thresholds.json. Sandy beach + kayak launch on the
  -- north side. Tidal/freshwater boundary; no JRA-tested swim spot here.
  ('chapel-island',
   'Chapel Island',
   37.526000, -77.419500,
   'access_point',
   ARRAY['island','trail','kayak-launch','tidal','sandy-beach','quiet','outside-floodwall'],
   true)

ON CONFLICT (slug) DO NOTHING;

-- ─── Activity matrix for the 12 new locations ───────────────────────────────
-- Per the per-cluster research findings. Existing locations' matrices from
-- migration 0016 are NOT touched.

-- Cluster A — trails (hike + bird-watching)
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug IN (
        'canal-walk',
        'manchester-floodwall-walk',
        'virginia-capital-trail',
        'reedy-creek',
        'the-wetlands'
      )
  AND a.slug IN ('hike', 'bird-watching')
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Dock Street Park — small waterfront park; adds fishing alongside the trail
-- pair (you can bank-fish from the riverwall here per JRPS riverside-park
-- conventions; not a JRA-tested swim spot).
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'dock-street-park'
  AND a.slug IN ('hike', 'bird-watching', 'fishing')
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Cluster B —

-- Tredegar Boat Ramp — paddle launch + fishing only. SWIM intentionally
-- NOT included (JRPS explicitly prohibits swimming at the boat ramp).
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'tredegar-boat-ramp'
  AND a.slug IN ('kayak-rapids', 'fishing')
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Ancarrow's Landing — fishing (shad/catfish), bird-watching (wetlands
-- adjacent), hike (Slave Trail terminus + MTB loop). No swim/wade — tidal
-- industrial corridor.
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'ancarrows-landing'
  AND a.slug IN ('fishing', 'bird-watching', 'hike')
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Huguenot Flatwater — calm-water paddle (the new kayak-flatwater),
-- swim (JRA-tested), fishing, bird-watching, hike. Carries downstream
-- Z-Dam / Bosher's hazard in flavor copy.
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'huguenot-flatwater'
  AND a.slug IN ('kayak-flatwater', 'swim', 'fishing', 'bird-watching', 'hike')
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Cluster C —

-- Tredegar Rope Swing — swim activity with min_age_override = 14.
-- This is the only activity on the site (rope swing itself surfaced via
-- flavor + warning copy, not as a tracked slug). The min_age 14 override
-- is the safety lever; combined with the per-location close-at-5-ft rule
-- in thresholds.json, this is how the rules engine produces the "older
-- kids only, close at high water" verdict for this card.
INSERT INTO location_activities (location_id, activity_id, min_age_override)
SELECT l.id, a.id, 14
FROM locations l, activities a
WHERE l.slug = 'tredegar-rope-swing'
  AND a.slug = 'swim'
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Manchester Climbing Wall — rock-climbing with min_age_override = 8
-- (the activities table default is 10; user direction 2026-06-05 sets 8
-- for this site, reflecting USA Climbing U11 norms + gym-graduate practice).
-- Plus bird-watching + hike for the approach via Floodwall Park.
INSERT INTO location_activities (location_id, activity_id, min_age_override)
SELECT l.id, a.id, CASE WHEN a.slug = 'rock-climbing' THEN 8 ELSE NULL END
FROM locations l, activities a
WHERE l.slug = 'manchester-climbing-wall'
  AND a.slug IN ('rock-climbing', 'bird-watching', 'hike')
ON CONFLICT (location_id, activity_id) DO NOTHING;

-- Chapel Island — gravel trail loop + kayak launch + fishing + birding.
-- No swim activity (research recommends against; freshwater-tidal boundary,
-- no JRA-tested data here).
INSERT INTO location_activities (location_id, activity_id)
SELECT l.id, a.id FROM locations l, activities a
WHERE l.slug = 'chapel-island'
  AND a.slug IN ('hike', 'kayak-flatwater', 'fishing', 'bird-watching')
ON CONFLICT (location_id, activity_id) DO NOTHING;

COMMIT;

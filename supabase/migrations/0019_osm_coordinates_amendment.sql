-- OSM coordinate cross-check amendment for the 12 locations seeded in 0017.
--
-- Migration 0017's lat/lngs were best-available estimates from the 2026-06-04
-- research workflow (cited in docs/locations-research-2026-06-04.md). We
-- flagged at the time that direct OSM cross-checks were pending.
--
-- This migration applies the OSM-verified coordinates for 9 of the 12 sites.
-- The remaining 3 stay at their research values:
--
--   - tredegar-boat-ramp     — 76m delta from OSM "Tredegar Iron Works".
--                              Inside positioning noise; keep research value.
--   - tredegar-rope-swing    — informal site, no OSM feature. The research
--                              value (eddy between Brown's Island and Belle
--                              Isle, below the CSX trestle) is the right
--                              physical anchor.
--   - chapel-island          — OSM returned "Chapel Island Stormwater Basin"
--                              which is a feature ON the island, not the
--                              island center. The research value (just east
--                              of Great Shiplock Park, matches the JRPS page
--                              description) is the right anchor.
--
-- Methodology: OSM Nominatim queries 2026-06-05 with the proper User-Agent.
-- Each authoritative hit cross-referenced against the research source before
-- accepting. Deltas of >100m treated as meaningful (locations rendered on a
-- mobile map at zoom 14 will look noticeably off-target otherwise).
--
-- The original migration 0017 file is NOT modified — migrations are
-- immutable. Future readers see the original lat/lng → the OSM-verified
-- correction in a discrete commit.

BEGIN;

-- Riverfront Canal Walk — anchor on OSM "Brown's Island" since the canal
-- walk runs along/through it. Research value (37.534, -77.440) was ~200m
-- east of the island midpoint.
UPDATE public.locations
   SET lat = 37.534023, lng = -77.442341
 WHERE slug = 'canal-walk';

-- Floodwall Park / Manchester Floodwall Walk — OSM "Floodwall Park" feature.
-- Research had the entry point ~330m north (at the Potterfield Bridge south
-- landing); OSM uses the park centroid.
UPDATE public.locations
   SET lat = 37.526866, lng = -77.435562
 WHERE slug = 'manchester-floodwall-walk';

-- Virginia Capital Trail (Richmond terminus) — OSM "Great Shiplock Park"
-- (2803 Dock St), which IS the Richmond mile-zero marker per the research.
-- Research value (37.5258, -77.4201) was ~200m west.
UPDATE public.locations
   SET lat = 37.526142, lng = -77.422494
 WHERE slug = 'virginia-capital-trail';

-- Dock Street Park — OSM "Dock Street Park" in Church Hill / East End.
-- Research value (37.529, -77.4319) was ~1.2km west — the research note
-- placed it east of Mayo Bridge but the actual park is significantly
-- further east than that.
UPDATE public.locations
   SET lat = 37.524358, lng = -77.419412
 WHERE slug = 'dock-street-park';

-- Reedy Creek (Park HQ Meadow) — OSM address "3315 Riverside Drive" which
-- is the JRPS HQ + parking node per the research. Research value was
-- ~2km northwest, in the wrong neighborhood entirely.
UPDATE public.locations
   SET lat = 37.523216, lng = -77.470877
 WHERE slug = 'reedy-creek';

-- The Wetlands — OSM address "3395 Landria Drive" matches the research's
-- cited JRPS entry address exactly. Research value was ~2.8km east of the
-- actual Landria Drive trailhead.
UPDATE public.locations
   SET lat = 37.544013, lng = -77.512364
 WHERE slug = 'the-wetlands';

-- Ancarrow's Landing — OSM address "1400 Brander Street" matches the
-- research's cited address. Research value (37.5083, -77.4272) was ~1.3km
-- south of the actual landing.
UPDATE public.locations
   SET lat = 37.519597, lng = -77.422815
 WHERE slug = 'ancarrows-landing';

-- Huguenot Flatwater — OSM "Huguenot Flatwater" feature on Riverside Drive.
-- Research value (37.5645, -77.5614) was ~2km east of the actual flatwater
-- access. The research-noted address conflict (8600 Riverside Dr vs 8600
-- Southampton Rd) was likely the source of the drift.
UPDATE public.locations
   SET lat = 37.558348, lng = -77.541790
 WHERE slug = 'huguenot-flatwater';

-- Manchester Climbing Wall — OSM "Manchester Wall Rock Climbing" feature.
-- Research had it co-located with Floodwall Park (37.5299, -77.4361) which
-- was wrong: the climbing wall sits ~1km west of the Floodwall Park parking,
-- closer to the south end of the Robert E. Lee Bridge.
UPDATE public.locations
   SET lat = 37.529568, lng = -77.445936
 WHERE slug = 'manchester-climbing-wall';

COMMIT;

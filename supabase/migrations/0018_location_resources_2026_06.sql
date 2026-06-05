-- Per-location resource links for the 12 new locations seeded in migration 0017.
--
-- Mirrors the 0006_location_resources pattern. Every URL traces to a source
-- cited in docs/locations-research-2026-06-04.md. URLs verified at the time
-- of the 2026-06-04 research workflow run — re-verify if any 404s emerge
-- before the next prod deploy.
--
-- Kind taxonomy (from resource_kind enum, 0006):
--   official  — government / agency primary page
--   parks     — JRPS or other parks-system "Explore the Park" page
--   safety    — gauge data, JRA water-quality, official safety guidance
--   community — secondary references, news, partner orgs
--
-- For the informal Tredegar Rope Swing location, resources are SAFETY-focused
-- (Use Caution on the River, recent incident press release) rather than
-- recreation-promoting — consistent with the published-with-warnings posture.

BEGIN;

-- ─── Cluster A — Trail / pedestrian-only ────────────────────────────────────

-- CANAL WALK
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Riverfront Canal Walk — Venture Richmond',       'https://venturerichmond.com/explore-downtown/riverfront-canal-walk/', 'official', 1),
  ('Explore the Park — James River Park System',     'https://jamesriverpark.org/explore-the-park/',                        'parks',    2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system',        'official', 3)
) AS r(title, url, kind, ord)
WHERE l.slug = 'canal-walk';

-- MANCHESTER FLOODWALL WALK / FLOODWALL PARK
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Floodwall Park — James River Park System',       'https://jamesriverpark.org/explore-the-park-floodwall-park/',         'parks',    1),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system',        'official', 2)
) AS r(title, url, kind, ord)
WHERE l.slug = 'manchester-floodwall-walk';

-- VIRGINIA CAPITAL TRAIL (Richmond terminus)
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Virginia Capital Trail Foundation',              'https://www.virginiacapitaltrail.org/',                                'official', 1),
  ('Great Shiplock Park (Richmond Mile 0) — JRPS',   'https://jamesriverpark.org/explore-the-park-great-shiplock-park-chapel-island/', 'parks', 2),
  ('Trail Info — Virginia Capital Trail Foundation', 'https://www.virginiacapitaltrail.org/trail-info/',                     'community', 3)
) AS r(title, url, kind, ord)
WHERE l.slug = 'virginia-capital-trail';

-- DOCK STREET PARK
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Parks & Recreation — City of Richmond',          'https://www.rva.gov/parks-recreation',                                 'official', 1),
  ('Explore the Park — James River Park System',     'https://jamesriverpark.org/explore-the-park/',                        'parks',    2)
) AS r(title, url, kind, ord)
WHERE l.slug = 'dock-street-park';

-- REEDY CREEK (Park HQ Meadow)
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Buttermilk Trail (accessed from Reedy Creek) — JRPS', 'https://jamesriverpark.org/explore-the-park/buttermilk-trail/',   'parks',    1),
  ('Friends of James River Park',                    'https://jamesriverpark.org/friends/',                                  'community', 2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system',        'official', 3)
) AS r(title, url, kind, ord)
WHERE l.slug = 'reedy-creek';

-- THE WETLANDS
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('The Wetlands — James River Park System',         'https://jamesriverpark.org/explore-the-park/the-wetlands/',           'parks',    1),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system',        'official', 2)
) AS r(title, url, kind, ord)
WHERE l.slug = 'the-wetlands';

-- ─── Cluster B — Boat ramps / water-access ──────────────────────────────────

-- TREDEGAR BOAT RAMP
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Tredegar Street Put-in / 14th St Take-out — JRPS', 'https://jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out/', 'parks', 1),
  ('River Safety — James River Park System',         'https://jamesriverpark.org/riversafety/',                              'safety',   2),
  ('USGS Westham Gauge (02037500) — Live Data',      'https://waterdata.usgs.gov/monitoring-location/02037500/',             'safety',   3),
  ('James River Watch — JRA',                        'https://thejamesriver.org/james-river-watch/',                         'safety',   4)
) AS r(title, url, kind, ord)
WHERE l.slug = 'tredegar-boat-ramp';

-- ANCARROW'S LANDING
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Ancarrow''s Landing — James River Park System',  'https://jamesriverpark.org/explore-the-park-ancarrows-landing-historic-manchester-slave-docks/', 'parks', 1),
  ('Parks & Recreation — City of Richmond',          'https://www.rva.gov/parks-recreation',                                 'official', 2),
  ('USGS City Locks Gauge (02037705) — Tidal Data',  'https://waterdata.usgs.gov/monitoring-location/02037705/',             'safety',   3),
  ('NOAA Tides — Richmond Locks (8638495)',          'https://tidesandcurrents.noaa.gov/stationhome.html?id=8638495',        'safety',   4)
  -- NOTE: a Richmond Slave Trail community resource was scoped but dropped
  -- 2026-06-05 — no working canonical URL on rva.gov, nps.gov, or major
  -- community sites at link-check time. Revisit if a stable URL surfaces.
) AS r(title, url, kind, ord)
WHERE l.slug = 'ancarrows-landing';

-- HUGUENOT FLATWATER
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Huguenot Flatwater — James River Park System',   'https://jamesriverpark.org/explore-the-park-huguenot-flatwater/',     'parks',    1),
  ('River Safety — James River Park System',         'https://jamesriverpark.org/riversafety/',                              'safety',   2),
  ('USGS Westham Gauge (02037500) — Live Data',      'https://waterdata.usgs.gov/monitoring-location/02037500/',             'safety',   3),
  ('James River Watch — JRA',                        'https://thejamesriver.org/james-river-watch/',                         'safety',   4),
  ('Use Caution on the River (dam hazards) — JRPS',  'https://jamesriverpark.org/use-caution-on-the-river/',                 'safety',   5)
) AS r(title, url, kind, ord)
WHERE l.slug = 'huguenot-flatwater';

-- ─── Cluster C — Sensitive sites ────────────────────────────────────────────

-- TREDEGAR ROPE SWING (informal — safety-focused resources)
-- JRPS does not maintain a page for the rope swing. The resources here
-- reinforce the published-with-warnings posture rather than recreation
-- promotion: the JRPS Use Caution page, the City press release on the
-- April 2026 drowning, and the closest sanctioned reference point.
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Use Caution on the River — James River Park System', 'https://jamesriverpark.org/use-caution-on-the-river/',             'safety',   1),
  ('April 2026 drowning press release — City of Richmond', 'https://rva.gov/press-releases-and-announcements/news/person-identified-apparent-drowning-james-river', 'safety', 2),
  ('Tredegar Street put-in / 14th St take-out — JRPS', 'https://jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out/', 'community', 3),
  ('River Safety — James River Park System',         'https://jamesriverpark.org/riversafety/',                              'safety',   4)
) AS r(title, url, kind, ord)
WHERE l.slug = 'tredegar-rope-swing';

-- MANCHESTER CLIMBING WALL
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Manchester Climbing Wall — James River Park System', 'https://jamesriverpark.org/explore-the-park-manchester-climbing-wall/', 'parks', 1),
  ('Manchester Wall route catalog — Mountain Project', 'https://www.mountainproject.com/area/106006682/manchester-wall',      'community', 2),
  ('USA Climbing — Rules & Resources',               'https://usaclimbing.org/about/resources/policies/',                     'safety',   3),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system',         'official', 4)
) AS r(title, url, kind, ord)
WHERE l.slug = 'manchester-climbing-wall';

-- CHAPEL ISLAND
INSERT INTO public.location_resources (location_id, title, url, kind, sort_order)
SELECT l.id, r.title, r.url, r.kind::resource_kind, r.ord
FROM public.locations l, (VALUES
  ('Great Shiplock Park / Chapel Island — JRPS',     'https://jamesriverpark.org/explore-the-park-great-shiplock-park-chapel-island/', 'parks', 1),
  ('Restoring Chapel Island — James River Association', 'https://thejamesriver.org/restoring-chapel-island-uncovering-history-and-restoring-habitat-along-the-james-river/', 'community', 2),
  ('The Low Line — Capital Trees',                   'https://capitaltrees.org/projects/low-line/',                          'community', 3),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system',         'official', 4)
) AS r(title, url, kind, ord)
WHERE l.slug = 'chapel-island';

COMMIT;

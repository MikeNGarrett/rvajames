-- Sub-goal 28: per-location official resource links.
-- All URLs verified 200 at migration time (2026-05-23). See plan notes for any 404s.

-- ─── resource_kind enum ───────────────────────────────────────────────────────

create type resource_kind as enum ('official', 'parks', 'safety', 'community');

-- ─── location_resources table ─────────────────────────────────────────────────

create table public.location_resources (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  title        text not null,
  url          text not null,
  kind         resource_kind not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index on public.location_resources (location_id, sort_order);

-- RLS: read-only for anon, full access for service role
alter table public.location_resources enable row level security;

create policy "anon can read location_resources"
  on public.location_resources for select to anon using (true);

create policy "service role full access location_resources"
  on public.location_resources for all to service_role using (true) with check (true);

-- ─── Seed: resource links (verified 200, 2026-05-23) ─────────────────────────
-- Format: INSERT INTO location_resources (location_id, title, url, kind, sort_order)
-- URLs that returned 404 are NOTED but omitted from seed (see comment at bottom).

-- BELLE ISLE
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Belle Isle — James River Park System',           'https://jamesriverpark.org/explore-the-park/belle-isle/', 'parks',   1),
  ('River Swimming Guide — James River Park System', 'https://jamesriverpark.org/swimming/',                    'safety',  2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 3),
  ('USGS Westham Gauge (02037500) — Live Data',      'https://waterdata.usgs.gov/monitoring-location/02037500/', 'safety', 4)
) as r(title, url, kind, ord)
where l.slug = 'belle-isle';

-- PONY PASTURE RAPIDS
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Pony Pasture — James River Park System',         'https://jamesriverpark.org/explore-the-park/pony-pasture/', 'parks',   1),
  ('River Swimming Guide — James River Park System', 'https://jamesriverpark.org/swimming/',                      'safety',  2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 3)
) as r(title, url, kind, ord)
where l.slug = 'pony-pasture';

-- TEXAS BEACH
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Texas Beach — James River Park System',          'https://jamesriverpark.org/explore-the-park/texas-beach/', 'parks',   1),
  ('River Swimming Guide — James River Park System', 'https://jamesriverpark.org/swimming/',                     'safety',  2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 3)
) as r(title, url, kind, ord)
where l.slug = 'texas-beach';

-- BROWNS ISLAND
-- Note: No dedicated Browns Island page found on jamesriverpark.org at seed time.
-- Using Potterfield Bridge page (the main crossing to/from the island) + USGS flood gauge.
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('T. Tyler Potterfield Memorial Bridge — JRPS',    'https://jamesriverpark.org/explore-the-park/t-tyler-potterfield-memorial-bridge/', 'parks', 1),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 2),
  ('USGS Westham Gauge (02037500) — Flood Reference','https://waterdata.usgs.gov/monitoring-location/02037500/', 'safety', 3),
  ('Richmond National Battlefield Park — NPS',       'https://www.nps.gov/rich/index.htm',                        'community', 4)
) as r(title, url, kind, ord)
where l.slug = 'browns-island';

-- MAYO ISLAND
-- Note: No dedicated Mayo Island page found on jamesriverpark.org at seed time.
-- Using JRPS explore index + City Locks tidal gauge (adjacent to the island).
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Explore the Park — James River Park System',     'https://jamesriverpark.org/explore-the-park/', 'parks',   1),
  ('USGS City Locks Gauge (02037705) — Tidal Data',  'https://waterdata.usgs.gov/monitoring-location/02037705/', 'safety', 2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 3)
) as r(title, url, kind, ord)
where l.slug = 'mayo-island';

-- SHIPLOCK TRAIL / CANAL WALK EAST
-- Note: No dedicated Shiplock/Canal Walk page found on JRPS at seed time.
-- NPS Richmond manages the historic Kanawha Canal context.
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Richmond National Battlefield Park — NPS',       'https://www.nps.gov/rich/index.htm',          'official', 1),
  ('Plan Your Visit — NPS Richmond',                 'https://www.nps.gov/rich/planyourvisit/index.htm', 'official', 2),
  ('USGS City Locks Gauge (02037705) — Flood Ref.',  'https://waterdata.usgs.gov/monitoring-location/02037705/', 'safety', 3),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 4)
) as r(title, url, kind, ord)
where l.slug = 'shiplock-trail';

-- NORTH BANK TRAIL
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('North Bank Trail — James River Park System',     'https://jamesriverpark.org/explore-the-park/north-bank-trail/', 'parks',   1),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 2),
  ('USGS Westham Gauge (02037500) — Live Data',      'https://waterdata.usgs.gov/monitoring-location/02037500/', 'safety', 3)
) as r(title, url, kind, ord)
where l.slug = 'north-bank-trail';

-- BUTTERMILK TRAIL
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Buttermilk Trail — James River Park System',     'https://jamesriverpark.org/explore-the-park/buttermilk-trail/', 'parks',   1),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 2)
) as r(title, url, kind, ord)
where l.slug = 'buttermilk-trail';

-- PUMP HOUSE / JAMES RIVER PARK HQ
insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Pump House Park — James River Park System',      'https://jamesriverpark.org/explore-the-park/pump-house-park/', 'parks',   1),
  ('River Swimming Guide — James River Park System', 'https://jamesriverpark.org/swimming/',                         'safety',  2),
  ('James River Park System — City of Richmond',     'https://www.rva.gov/parks-recreation/james-river-park-system', 'official', 3),
  ('James River Association',                        'https://thejamesriver.org/about/',                             'community', 4)
) as r(title, url, kind, ord)
where l.slug = 'pump-house';

-- ─── 404 notes (URLs verified not available at seed time 2026-05-23) ──────────
-- jamesriverpark.org/explore-the-park/browns-island/ → 404
-- jamesriverpark.org/explore-the-park/mayo-island/ → 404
-- jamesriverpark.org/explore-the-park/mayo-island-paddle-access/ → 404
-- jamesriverpark.org/explore-the-park/shiplock-park/ → 404
-- jamesriverpark.org/explore-the-park/canal-walk/ → 404
-- www.rva.gov/parks-recreation/belle-isle → 404
-- www.rva.gov/parks-recreation/browns-island → 404
-- www.nps.gov/rich/planyourvisit/canal-walk.htm → 404
-- thejamesriver.org/swim/ → 404 (JRA site seems restructured)

-- RVA James — initial schema
-- Apply with: supabase db push

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type advisory_kind as enum (
  'flood_watch',
  'flood_warning',
  'flood_advisory',
  'cso_overflow',
  'water_quality',
  'swim_closure',
  'general'
);

create type advisory_severity as enum ('low', 'moderate', 'high', 'extreme');

create type age_bucket as enum ('0-2', '3-5', '6-9', '10-13', '14+');

create type surface_type as enum ('water', 'rock', 'trail', 'mixed');

-- ─── locations ───────────────────────────────────────────────────────────────

create table locations (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  lat              numeric(9, 6) not null,
  lng              numeric(9, 6) not null,
  usgs_station_id  text,
  nws_grid         text,
  jra_site_id      text,
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now()
);

-- ─── activities ──────────────────────────────────────────────────────────────

create table activities (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  min_age        integer not null default 0,
  requires_swim  boolean not null default false,
  surface_type   surface_type not null,
  created_at     timestamptz not null default now()
);

-- ─── location_activities (m2m) ───────────────────────────────────────────────

create table location_activities (
  location_id  uuid not null references locations(id) on delete cascade,
  activity_id  uuid not null references activities(id) on delete cascade,
  primary key (location_id, activity_id)
);

-- ─── conditions_snapshots ────────────────────────────────────────────────────

create table conditions_snapshots (
  id             uuid primary key default gen_random_uuid(),
  location_id    uuid not null references locations(id) on delete cascade,
  source         text not null,
  fetched_at     timestamptz not null default now(),
  payload        jsonb not null default '{}',
  gage_ft        numeric(6, 2),
  discharge_cfs  numeric(10, 2),
  water_temp_f   numeric(5, 2),
  air_temp_f     numeric(5, 2),
  precip_in      numeric(6, 3)
);

create index on conditions_snapshots (location_id, fetched_at desc);
create index on conditions_snapshots (source, fetched_at desc);

-- ─── advisories ──────────────────────────────────────────────────────────────

create table advisories (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,
  kind             advisory_kind not null,
  severity         advisory_severity not null,
  headline         text not null,
  body             text not null default '',
  effective_from   timestamptz not null,
  effective_to     timestamptz,
  location_ids     uuid[] not null default '{}',
  created_at       timestamptz not null default now()
);

create index on advisories (effective_from, effective_to);
create index on advisories (severity);

-- ─── ai_interpretations ──────────────────────────────────────────────────────

create table ai_interpretations (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  location_id  uuid not null references locations(id) on delete cascade,
  age_bucket   age_bucket not null,
  model        text not null,
  prompt_hash  text not null,
  body_md      text not null,
  prep_items   jsonb not null default '[]',
  tokens_in    integer not null default 0,
  tokens_out   integer not null default 0,
  cost_usd     numeric(10, 6) not null default 0,
  created_at   timestamptz not null default now(),
  unique (date, location_id, age_bucket, prompt_hash)
);

create index on ai_interpretations (date, location_id);
create index on ai_interpretations (created_at desc);

-- ─── ingestion_runs ──────────────────────────────────────────────────────────

create table ingestion_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  error         text,
  rows_written  integer not null default 0
);

create index on ingestion_runs (source, started_at desc);

-- ─── Seed: locations ─────────────────────────────────────────────────────────

insert into locations (slug, name, lat, lng, usgs_station_id, nws_grid, tags) values
  ('belle-isle',
   'Belle Isle',
   37.528900, -77.461800,
   '02037500',
   'AKQ/36,78',
   array['island','rapids','swimming','rock-hopping','hiking','parking-limited']),

  ('pony-pasture',
   'Pony Pasture Rapids',
   37.540200, -77.524700,
   '02037500',
   'AKQ/35,78',
   array['rapids','swimming','dog-friendly','parking','family-popular']),

  ('texas-beach',
   'Texas Beach',
   37.533100, -77.499200,
   '02037500',
   'AKQ/36,78',
   array['beach','swimming','rocky-shore','parking']),

  ('browns-island',
   'Browns Island',
   37.532500, -77.449300,
   '02037500',
   'AKQ/36,78',
   array['island','events','walking','downtown-adjacent']),

  ('mayo-island',
   'Mayo Island',
   37.530800, -77.444600,
   '02037500',
   'AKQ/36,78',
   array['island','kayak-launch','fishing','trail']),

  ('shiplock-trail',
   'Shiplock Trail / Canal Walk East',
   37.530200, -77.440100,
   '02037500',
   'AKQ/36,78',
   array['trail','historical','canal','walking','stroller-friendly']),

  ('north-bank-trail',
   'North Bank Trail',
   37.536400, -77.470200,
   '02037500',
   'AKQ/36,78',
   array['trail','hiking','mountain-bike','multi-use','parking']),

  ('buttermilk-trail',
   'Buttermilk Trail',
   37.531600, -77.489300,
   '02037500',
   'AKQ/35,78',
   array['trail','hiking','challenging','rocky','no-dogs-on-leash-required']),

  ('pump-house',
   'Pump House / James River Park Headquarters',
   37.545200, -77.531600,
   '02037500',
   'AKQ/35,78',
   array['park-hq','picnic','trail-access','swimming','family-friendly','parking']);

-- ─── Seed: activities ────────────────────────────────────────────────────────

insert into activities (slug, name, min_age, requires_swim, surface_type) values
  ('swim',
   'Swimming',
   5,
   true,
   'water'),

  ('kayak-rapids',
   'Kayaking / Whitewater',
   10,
   true,
   'water'),

  ('rock-hop',
   'Rock-Hopping',
   4,
   false,
   'rock'),

  ('bridge-crossing',
   'T. Tyler Potterfield Memorial Bridge Crossing',
   3,
   false,
   'mixed'),

  ('belle-isle-pedestrian',
   'Belle Isle Pedestrian Bridge',
   3,
   false,
   'mixed'),

  ('beach-access',
   'Beach / Shore Access',
   0,
   false,
   'mixed'),

  ('hike',
   'Hiking / Trail Walk',
   2,
   false,
   'trail');

-- ─── Seed: location_activities ───────────────────────────────────────────────

-- Belle Isle
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'belle-isle'
  and a.slug in ('swim', 'rock-hop', 'bridge-crossing', 'belle-isle-pedestrian', 'beach-access', 'hike');

-- Pony Pasture
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'pony-pasture'
  and a.slug in ('swim', 'rock-hop', 'beach-access', 'hike');

-- Texas Beach
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'texas-beach'
  and a.slug in ('swim', 'rock-hop', 'beach-access');

-- Browns Island
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'browns-island'
  and a.slug in ('beach-access', 'hike', 'bridge-crossing');

-- Mayo Island
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'mayo-island'
  and a.slug in ('kayak-rapids', 'beach-access', 'hike');

-- Shiplock Trail
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'shiplock-trail'
  and a.slug in ('hike', 'beach-access');

-- North Bank Trail
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'north-bank-trail'
  and a.slug in ('hike', 'rock-hop');

-- Buttermilk Trail
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'buttermilk-trail'
  and a.slug in ('hike');

-- Pump House
insert into location_activities (location_id, activity_id)
select l.id, a.id from locations l, activities a
where l.slug = 'pump-house'
  and a.slug in ('swim', 'beach-access', 'hike');

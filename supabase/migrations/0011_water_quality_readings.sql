-- Migration 0011: water_quality_readings table
-- Stores raw E. coli / Enterococci readings from the JRA ArcGIS FeatureServer.
-- Advisories are derived in application code (sub-goal 70) from these readings.

create table water_quality_readings (
  id                        uuid primary key default gen_random_uuid(),

  -- Station identity
  station_name              text not null,        -- normalized display name (e.g. "Pony Pasture")
  station_code              text,                 -- short code from ArcGIS `name` field (e.g. "J41")
  station_global_id         text unique not null, -- ArcGIS GlobalID — dedup key for upserts
  organization              text,                 -- collecting partner (e.g. "JRA")

  -- Location
  latitude                  double precision,
  longitude                 double precision,

  -- Timing
  collected_at              timestamptz not null, -- sample collection time (from CollectionDate or creationdate)
  fetched_at                timestamptz not null default now(),

  -- Bacteria (the headline indicators)
  ecoli_cfu_per_100ml       double precision,     -- VDH single-sample max: 235 CFU/100mL
  enterococci_cfu_per_100ml double precision,     -- VDH single-sample max: 104 CFU/100mL
  ecoli_average             double precision,     -- pre-computed running average from JRA
  enterococci_average       double precision,

  -- Secondary indicators
  water_temp_f              double precision,     -- converted from Celsius on ingest
  air_temp_f                double precision,
  conductivity              double precision,
  turbidity                 double precision,
  salinity                  double precision,

  -- Volunteer notes
  site_conditions           text,                 -- free-text observation (up to 1000 chars in ArcGIS)

  -- Full feature payload preserved for schema evolution
  raw_payload               jsonb
);

-- Primary query pattern: latest reading for a given station
create index water_quality_readings_station_date_idx
  on water_quality_readings (station_name, collected_at desc);

-- Enable RLS — anon can read, service role can write
alter table water_quality_readings enable row level security;

create policy "anon_read"
  on water_quality_readings
  for select
  to anon
  using (true);

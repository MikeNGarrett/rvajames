-- USGS daily percentile statistics
-- Populated by the /api/cron/usgs-percentiles route (runs daily at 03:00 UTC).
-- Used by lib/queries/normal-range.ts to provide "current vs seasonal" context.
--
-- Note: for USGS 02037500 the stats service only has approved data for
-- discharge (00060), not gage height (00065). Rows are stored exactly as
-- the USGS RDB response delivers them.

create table usgs_percentiles (
  id           uuid primary key default gen_random_uuid(),
  station_id   text    not null,            -- e.g. '02037500'
  parameter_cd text    not null,            -- '00060' (discharge) or '00065' (gage height)
  day_of_year  smallint not null,           -- 1..366, computed from month_nu + day_nu
  month_nu     smallint not null,           -- 1..12
  day_nu       smallint not null,           -- 1..31
  p10          numeric,
  p25          numeric,
  p50          numeric,
  p75          numeric,
  p90          numeric,
  record_count integer,                     -- years of data behind these percentiles
  fetched_at   timestamptz not null default now(),
  unique (station_id, parameter_cd, day_of_year)
);

alter table usgs_percentiles enable row level security;
create policy "anon_read" on usgs_percentiles for select to anon using (true);

create index usgs_percentiles_lookup_idx
  on usgs_percentiles (station_id, parameter_cd, day_of_year);

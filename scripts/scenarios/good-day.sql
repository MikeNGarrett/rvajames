-- DESC: clean all-clear baseline (no advisories, normal gage, fresh) — contrast
-- Local-only fixture. See scripts/scenarios/README.md.
begin;

-- Clear advisory + overflow noise so the metro reads as a calm summer day.
delete from advisories;
update cso_outfalls set current_overflow = false, current_overflow_observed_at = null;

-- Fresh, safe upriver (Westham) + downriver (City Locks) gage readings.
insert into conditions_snapshots (location_id, source, gage_ft, water_temp_f, discharge_cfs, fetched_at)
select id, 'usgs', 3.20, 75.0, 3000, now() from locations where slug = 'usgs-02037500';
insert into conditions_snapshots (location_id, source, gage_ft, water_temp_f, fetched_at)
select id, 'usgs', 1.60, 75.0, now() from locations where slug = 'usgs-02037705';

commit;

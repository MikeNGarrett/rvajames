-- DESC: active flood watch + severe thunderstorm watch -> severe-weather banner + gate
-- Local-only fixture. See scripts/scenarios/README.md.
begin;

-- Clean slate so the ONLY signal under test is the weather: clear advisories +
-- CSO and normalize the gage to a calm, safe level. The point is to prove a
-- calm river does NOT suppress the severe-weather banner.
delete from advisories;
update cso_outfalls set current_overflow = false, current_overflow_observed_at = null;
insert into conditions_snapshots (location_id, source, gage_ft, water_temp_f, discharge_cfs, fetched_at)
select id, 'usgs', 3.20, 78.0, 3000, now() from locations where slug = 'usgs-02037500';

-- NWS alerts exactly as the ingest writes them: source 'nws', empty
-- location_ids (metro-wide). A flood_watch + a severe thunderstorm watch
-- (kind 'general' / severity high — there is no thunderstorm enum value) both
-- resolve to the 'watch' tier in severeWeatherStatus().
--   • Bump either severity to 'extreme', or put "Warning" in the headline, to
--     escalate the gate to the 'warning' tier.
insert into advisories (source, source_id, kind, severity, headline, body, effective_from, effective_to, location_ids)
values
  ('nws', 'scenario:flood-watch', 'flood_watch', 'high',
   'Flood Watch in effect until 4:15 PM EDT',
   'Heavy rain may cause flooding of rivers, creeks, and low-lying areas.',
   now() - interval '2 hours', now() + interval '6 hours', '{}'::uuid[]),
  ('nws', 'scenario:svr-tstorm-watch', 'general', 'high',
   'Severe Thunderstorm Watch until 8:00 PM EDT',
   'Conditions are favorable for severe thunderstorms with damaging winds and large hail.',
   now() - interval '1 hour', now() + interval '5 hours', '{}'::uuid[]);

commit;

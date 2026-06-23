-- DESC: Westham gage at 9.5 ft (danger), no CSO noise -> #3 deny-pill contrast
-- Local-only fixture. See scripts/scenarios/README.md.
begin;

-- Clear CSO/advisory noise so the danger styling comes purely from river level.
delete from advisories;
update cso_outfalls set current_overflow = false, current_overflow_observed_at = null;

-- Fresh upriver reading above the 8.0 ft danger threshold. Swim spots
-- (Pony Pasture, Belle Isle, Texas Beach, Huguenot) flip to the danger card +
-- a "✗ Swimming" deny chip — whose bg-status-danger-subtle matches the card
-- background, so the pill has no visible boundary (issue #3).
insert into conditions_snapshots (location_id, source, gage_ft, water_temp_f, discharge_cfs, fetched_at)
select id, 'usgs', 9.50, 74.0, 20000, now() from locations where slug = 'usgs-02037500';

commit;

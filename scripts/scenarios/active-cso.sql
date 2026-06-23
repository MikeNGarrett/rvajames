-- DESC: active sewer overflows (banner + per-card "no swimming" header) -> #2 #4 #5
-- Local-only fixture. See scripts/scenarios/README.md.
begin;

-- Deterministic slate: clear prior CSO state, normalize gage to safe so the
-- only signal under test is the overflow advisory (not river level).
delete from advisories;
update cso_outfalls set current_overflow = false, current_overflow_observed_at = null;
insert into conditions_snapshots (location_id, source, gage_ft, water_temp_f, discharge_cfs, fetched_at)
select id, 'usgs', 3.20, 78.0, 3000, now() from locations where slug = 'usgs-02037500';

-- 6 westmost (most upstream) mainstem outfalls discharging right now.
update cso_outfalls set current_overflow = true, current_overflow_observed_at = now()
where id in (
  select id from cso_outfalls where affects_james_mainstem order by lng limit 6
);

-- One cso_overflow advisory per upstream mainstem outfall, with EMPTY
-- location_ids. The empty array is what the real EmNet ingest writes, and it's
-- what makes the "Active CSO overflow advisory — no swimming" header land on
-- EVERY location card — including spots that truthfully read "No overflows
-- upstream" (issue #2) and non-swim sites like Ancarrow's (issue #4). The
-- deterministic "Fair day…" headline above it is issue #5.
insert into advisories (source, kind, severity, headline, body, effective_from, effective_to, location_ids, outfall_id)
select 'emnet_cso', 'cso_overflow', 'high',
       'Combined sewer overflow active — no swimming for 48 h',
       'Bacterial contamination elevated for at least 48 h after each overflow.',
       now() - interval '12 hours', now() + interval '36 hours', '{}'::uuid[], o.id
from cso_outfalls o
where o.affects_james_mainstem
order by o.lng
limit 6;

commit;

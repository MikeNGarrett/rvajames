-- DESC: mark a swim spot (Texas Beach) closed/active -> closed-mode tile
-- Local-only fixture. See scripts/scenarios/README.md.
begin;

-- Idempotent: drop any prior fixture closure before re-inserting.
delete from location_status where source = 'scenario-fixture';

insert into location_status (location_id, kind, state, reason, source, effective_from)
select id, 'closed', 'active',
       'Temporary closure for trail repair (scenario fixture).',
       'scenario-fixture', now()
from locations where slug = 'texas-beach';

commit;

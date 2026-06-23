-- DESC: backdate latest USGS snapshot ~3h (past the 30-min freshness window) -> #1
-- Local-only fixture. See scripts/scenarios/README.md.
--
-- Surfaces the "USGS data hasn't updated in N minutes" banner — the visible
-- symptom of a homepage tab left idle. (The server already redirects an
-- out-of-window ?date= to today with a notice; the remaining gap is the lack
-- of a client-side auto-refresh when the day rolls over.)
update conditions_snapshots
set fetched_at = now() - interval '3 hours'
where source = 'usgs';

# Local UI scenario harness

Deterministic data fixtures for exercising the homepage / location tiles against
edge-case conditions **on the local Supabase stack only**. Each scenario is a
self-contained SQL delta that sets exactly the state it needs (clearing any
conflicting state first), so they can be applied in any order and re-run safely.

These are a regression aid for the conditions UI — flood/danger styling, CSO
messaging coherence, swim-advisory headlines, and staleness handling.

> **Local only.** Every command here targets the local Postgres at
> `127.0.0.1:54322`. Nothing in this directory can touch production — there is
> no prod connection string anywhere in it. (Prod data writes are blocked by
> `.claude/hooks/block-prod-actions.sh` regardless.)

## Prerequisites

1. Local Supabase running: `supabase start`
2. Schema applied: `supabase db reset` (local; re-runs migrations + seeds locations)
3. A realistic **baseline** ingested from the live public APIs (USGS / NWS /
   Open-Meteo / EmNet / JRA — *not* prod). With the dev server running:

   ```bash
   ./scripts/scenarios/load.sh baseline      # curls the local cron routes
   ```

   The baseline gives you real gage/temperature, the NWS+Open-Meteo hourly
   payload the Richmond Conditions section needs, the CSO outfall geometry, and
   water-quality readings. Scenarios layer on top of it.

4. Dev server running on port 3001 (override with `PORT=…`):

   ```bash
   node_modules/.bin/next dev --port 3001
   ```

## Usage

```bash
./scripts/scenarios/load.sh <scenario>     # apply a scenario delta
./scripts/scenarios/load.sh --list         # list scenarios
./scripts/scenarios/load.sh baseline       # (re)ingest live public-API baseline
```

Then reload `http://localhost:3001/` (or a location detail page) in the browser.

To return to a clean realistic state, re-run `load.sh baseline`, or
`load.sh good-day` for a deterministic all-clear.

## Scenarios

| Scenario          | What it sets                                                                 | UI issue it exercises |
|-------------------|------------------------------------------------------------------------------|-----------------------|
| `good-day`        | Clears advisories + overflow flags, normal gage (3.2 ft), fresh timestamp    | baseline / contrast   |
| `active-cso`      | 6 mainstem outfalls discharging + 7 CSO advisories (empty `location_ids`)     | #2, #4, #5            |
| `danger-river`    | Upriver Westham gage at 9.5 ft (danger), no CSO noise                        | #3                    |
| `stale-data`      | Backdates the latest USGS snapshot ~3 h (past the 30-min freshness window)    | #1                    |
| `closed-location` | Marks a swim spot (Texas Beach) `closed` / `active`                          | closed-mode tile      |
| `severe-weather`  | Active flood watch + severe thunderstorm watch (NWS), calm gage              | severe-weather banner + headline gate |

### Mapping to the triaged UI issues

- **#1 — idle homepage / stale data.** `stale-data` surfaces the "USGS data
  hasn't updated in N minutes" banner. Note the server already handles an
  out-of-window `?date=` gracefully (redirects to today with a notice); the gap
  is purely client-side: no auto-refresh when a tab's day rolls over.
- **#2 — "CSO overflows" + "No overflows upstream" on the same card.** `active-cso`
  inserts advisories with empty `location_ids`, which apply to every location,
  so each card shows the "Active CSO overflow advisory — no swimming" header even
  for spots that truthfully read "No overflows upstream" (e.g. Belle Isle).
- **#3 — deny pill blends into the danger card.** `danger-river` puts swim spots
  into danger styling. The "✗ Swimming" chip uses `bg-status-danger-subtle`,
  the *same* token as the danger card background, with white text — so it has no
  visible boundary.
- **#4 — Ancarrow's advises "no swimming" but offers no swim activity.** Under
  `active-cso`, the global advisory header lands on Ancarrow's (a non-swim site)
  alongside an accurate "N overflows upstream" (it sits downstream).
- **#5 — "Fair day to be out" while an avoid-water advisory is active.** Under
  `active-cso` the deterministic headline still reads "Fair day…" because the
  happiness index is weather-driven and doesn't fold in the swim verdict.

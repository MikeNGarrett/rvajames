# RVA James — CSO Event Ingestion via EmNet (Cloudflare Browser Rendering)

## Context

The City of Richmond Department of Public Utilities (DPU) has retired its
rva.gov CSO advisory page in favor of a new authoritative real-time map at
[apps.emnet.net/richmond-pub-map-app](https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9)
(BLU-X by Xylem Inc.). Our `lib/ingest/cso.ts` scraper has been silently
returning zero rows for weeks against the deprecated URLs (`/taxonomy/term/92/feed`
and `/public-utilities/wastewater-utility`) — confirmed via
`select * from ingestion_runs where source='cso' order by started_at desc`:
all runs `ok=true` with `rows_written=0`.

Reproduction of the gap: a CSO event within the past 48h is visible to the
public on the emnet map but does not surface anywhere in our app. Bacterial
safety is the top family-safety signal per the original plan — this is
launch-blocking.

### Direction confirmed by the user

- **Data source: headless-browser ingest of the public emnet map via Cloudflare
  Browser Rendering** (paid Workers plan feature, ~$5/mo base).
  Authenticated JSON access requires a contract with Xylem that's not viable
  for this side project. Manual admin entry was considered and rejected —
  family-safety data shouldn't depend on operator vigilance.
- **Block launch until shipped.** No soft-launch with a "coming soon" banner.
- **Per-location upstream/downstream context.** A CSO event at the Manchester
  outfall affects Pony Pasture (downstream) but NOT Pump House (upstream of
  Manchester). The current "one advisory affects all swimming locations"
  model is too coarse.

## Available data from emnet

Confirmed via inspection of the public map app's bundled chunks:

- Visualization config (UUID `5c0cacee-7e95-4eea-922d-c736c83eb4b9`) lists
  all CSO monitoring + modeled sites for city 47 (Richmond).
- Each site object has:
  - `id` — emnet site UUID
  - `site_config.name` — e.g. "Manchester CSO outfall 005"
  - `site_config.coords` — lat/lng (rendered onto the OpenLayers map)
  - `site_config.bodies` — affected water body names (e.g. "James River",
    "Gillies Creek")
  - `site_config.note` — optional operator notes
  - `analysis_results.cso_last_occurrence` — ISO timestamp of last discharge
  - `analysis_results.last_overflow_event` — flag
  - `analysis_results.overflow` — current state (true/false/null)
  - `site_config.site_type` — "monitored" vs "modeled"
- The app polls the JSON authenticated API every `refresh_timer_interval_in_ms`
  (typically 5 min) but the **rendered DOM** + React state contain the same
  data — accessible via `page.evaluate()` without auth.

## Confirmed decisions

- **Ingest cadence: twice daily.** Reuse the existing CSO cron schedule
  (`0 6,18 * * *`) — Cloudflare free-tier cron limit is saturated at 5; we
  cannot add a new trigger. The new ingest replaces `lib/ingest/cso.ts`
  internals; the cron route stays at `app/api/cron/cso/route.ts`.
- **Schema: new `cso_outfalls` catalog table + `advisories.outfall_id` FK.**
  Separates static outfall catalog (rarely changes) from event data
  (changes per discharge). Keeps the existing advisory shape intact.
- **Upstream determination v1: longitude comparison.** James River through
  Richmond flows roughly west-to-east; outfall with smaller longitude than
  an access point is "upstream" of it. Acknowledged simplification — the
  river bends at the Fall Line, so longitude doesn't perfectly track
  thalweg distance. Accepted; revisit if the bend areas produce visibly
  wrong results in practice.
- **Filter to mainstem only.** Outfalls whose `bodies` doesn't include
  "James River" (e.g., discharges directly to Gillies Creek or Stony Run)
  are ingested into the catalog but DO NOT generate advisories. Tributary
  discharges eventually reach the James but the impact is too diffuse to
  signal at the access-point level without river-modeling depth we don't
  have.
- **Effective-to: 48 hours after `cso_last_occurrence`.** Standard
  bacterial half-life rule, matches the existing CSO logic.
- **Severity: 'high' for all CSO events.** No tiering — any CSO is a
  family-safety signal.
- **Brittleness mitigation.** Browser-rendering scrape is fragile against
  emnet UI changes. The ingest is wrapped in `withIngestionRun` (Finding 18)
  so a parse failure is logged loudly as `ok=false` on `/status`. Add a
  `/status` row check + email alert if we go 48h without a successful
  CSO run.

## Continues sub-goal numbering: 80 → 85

---

## Sub-goal 80 — Schema: cso_outfalls table + advisory FK

**Why:** Foundation. Need a place to store outfall lat/lng + name before
the ingest writes them.

**Deliverables**

`supabase/migrations/00NN_cso_outfalls.sql`:

```sql
CREATE TABLE cso_outfalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emnet_id text UNIQUE NOT NULL,        -- site UUID from emnet config
  name text NOT NULL,                   -- display name from emnet
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  bodies text[] NOT NULL DEFAULT '{}',  -- affected water bodies
  site_type text NOT NULL,              -- 'monitored' or 'modeled'
  affects_james_mainstem boolean NOT NULL DEFAULT false,  -- derived from bodies
  last_seen_at timestamptz NOT NULL DEFAULT now(),  -- updated each ingest run
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cso_outfalls_emnet_id_idx ON cso_outfalls (emnet_id);
CREATE INDEX cso_outfalls_lng_idx ON cso_outfalls (lng) WHERE affects_james_mainstem;

ALTER TABLE advisories ADD COLUMN outfall_id uuid REFERENCES cso_outfalls(id);
CREATE INDEX advisories_outfall_id_idx ON advisories (outfall_id)
  WHERE outfall_id IS NOT NULL;
```

RLS: `cso_outfalls` gets the same anon-read pattern as `locations`. Write
access via service role only.

**Success**
- Migration applies cleanly on local Supabase (`supabase db reset`).
- Types regenerated; `Database['public']['Tables']['cso_outfalls']` exists.
- No existing data affected (FK is NULL on all existing advisory rows).
- agent_reader role can SELECT from cso_outfalls (re-verify with
  `pnpm query:prod` against staging — won't run against prod until human
  applies migration per CLAUDE.md security policy).

**Phase handoff**
End of sub-goal: agent commits, STOPS, hands off migration application to
human (Supabase Studio SQL editor). Subsequent sub-goals can proceed in
parallel as long as they don't depend on prod-side migration application.

---

## Sub-goal 81 — Cloudflare Browser Rendering binding + wrangler config

**Why:** Need the platform feature enabled before any code can use it.

**Deliverables**

Documentation only (no agent code changes — this is human-side configuration):

`docs/cso-emnet-plan.md` — append "Operational setup" section with:
- Steps to enable Workers Paid on the account
- Steps to enable Browser Rendering on the workers account
- The wrangler.jsonc snippet to add the binding once enabled:

```jsonc
"browser": {
  "binding": "BROWSER"
}
```

Add `@cloudflare/puppeteer` to package.json (dev dep) — actual usage in
sub-goal 82.

**Human handoff:**
1. Cloudflare dashboard → Workers & Pages → Plan → upgrade to Workers Paid
   if not already
2. Workers & Pages → Browser Rendering → Enable
3. Confirm by running `wrangler browser-rendering list` (CLI v3+)
4. Add the `browser` binding block to `wrangler.jsonc` and `wrangler deploy`
   (the user runs `pnpm deploy:cf` — code change comes in sub-goal 82)

**Success**
- `@cloudflare/puppeteer` installed
- Documentation matches the actual dashboard UX (verify by walking through
  it once)
- The binding is added to `wrangler.jsonc` but the worker that uses it
  doesn't exist yet — so deploy works without errors

---

## Sub-goal 82 — Emnet ingest: lib/ingest/cso-emnet.ts

**Why:** The actual data fetcher.

**Deliverables**

`lib/ingest/cso-emnet.ts`:

```ts
import puppeteer from '@cloudflare/puppeteer';

const EMNET_URL =
  'https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9';

export async function fetchEmnetSites(env: Env) {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    // Block analytics + tracking that's not needed for data extraction
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('google-analytics') || url.includes('googletagmanager')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(EMNET_URL, { waitUntil: 'networkidle0', timeout: 30_000 });

    // Emnet renders site features as OpenLayers vector features; the React
    // app stores the parsed site_data in component state. Easiest extraction
    // is via the feature collection on the map.
    //
    // The fallback path is to read the page's React fiber root and traverse
    // to the SiteList state — but the OpenLayers approach is more stable.
    const sites = await page.evaluate(() => {
      // Find the OpenLayers map instance (attached to #map element)
      const mapEl = document.getElementById('map');
      if (!mapEl) throw new Error('no #map element on emnet page');
      const olMap = (mapEl as any).__OL_MAP__ ?? (window as any).__emnetMap;
      // If neither global is present, try traversing OpenLayers layers off
      // any property of the React root. See chunk inspection notes.
      // Return the site collection.
      // [implementation completed during sub-goal execution]
      return [];
    });

    return sites;
  } finally {
    await browser.close();
  }
}
```

Real implementation details left for agent execution — the page-evaluate
extraction needs to be developed against the actual emnet page during the
sub-goal. Key requirements:

- Wait for the map to fully render (sites loaded) before extracting — the
  app polls; the first render may be empty
- Extract per site: emnet_id, name, lat, lng, bodies, site_type,
  cso_last_occurrence
- Filter to sites where `bodies` includes a James River reference
  ("James River", "James", etc. — case-insensitive substring match)

Replace `lib/ingest/cso.ts` internals to call `fetchEmnetSites()` and:

1. Upsert each site into `cso_outfalls` (by `emnet_id`):
   - On insert: set `lat`, `lng`, `bodies`, `site_type`,
     `affects_james_mainstem` (true if bodies matches mainstem rule).
   - On update: refresh `last_seen_at` + bodies/site_type in case they changed.
   - Always update `last_seen_at` (proves the outfall is still in the feed).

2. For each outfall where `cso_last_occurrence` is within the last 48h
   AND `affects_james_mainstem` is true, upsert an advisory with:
   - `source = 'emnet_cso'`
   - `source_id = '{emnet_id}:{cso_last_occurrence_iso}'`
   - `kind = 'cso_overflow'`
   - `severity = 'high'`
   - `outfall_id = <upserted outfall id>`
   - `headline = "CSO discharge at {outfall_name}"`
   - `body = "Combined sewer overflow event recorded {time_ago} at {outfall_name}. Bacterial levels likely elevated downstream of this point for ~48 hours."`
   - `effective_from = cso_last_occurrence`
   - `effective_to = cso_last_occurrence + 48h`
   - `location_ids = []` — the per-location upstream check happens at
     query time, NOT bake-time.

`app/api/cron/cso/route.ts` — no route changes; the underlying ingest
swap is internal.

**Tests**

`lib/ingest/cso-emnet.test.ts` — unit tests for:
- Outfall body filter (mainstem true/false logic)
- Source ID format
- 48h window math (in/out edge cases)
- Severity assignment

Cannot test the puppeteer integration in vitest. That gets manual smoke
testing via `pnpm dev` + manual cron trigger.

**Success**
- pnpm tsc / lint / test clean (existing 151 + new tests)
- Local smoke test: trigger /api/cron/cso, confirm:
  - `cso_outfalls` table populated with all Richmond CSO sites
  - `advisories` table has new `cso_overflow` rows IF the live emnet map
    shows recent events
- ingestion_runs row: `source='cso'`, `ok=true`, `rows_written=N` where
  N = (outfalls upserted) + (advisories upserted)

---

## Sub-goal 83 — Upstream spatial rules + per-location signals

**Why:** Make the data actionable.

**Deliverables**

`lib/safety/upstream-cso.ts` — new module:

```ts
export interface UpstreamCsoSignal {
  count: number;                       // active CSO events upstream
  mostRecentAt: string | null;         // ISO timestamp
  outfallNames: string[];              // for display
}

export async function getUpstreamCsoForLocation(
  locationLng: number,
  windowHours: number = 48,
): Promise<UpstreamCsoSignal>;
```

Query: from `advisories` joined to `cso_outfalls`, find rows where:
- `kind = 'cso_overflow'`
- `effective_from > now() - interval '48 hours'`
- `outfall.lng < <locationLng>` (upstream)
- `outfall.affects_james_mainstem = true`

`lib/queries/today.ts` — extend `LocationSummary` with:
```ts
upstreamCso: UpstreamCsoSignal | null;  // null = no signal worth showing
```

Set to non-null only if `count > 0`. Populate via parallel query in both
`getObservedTodayData` and `getForecastTodayData`.

`lib/safety/rules.ts` — extend `combinedLocationStatus` to consider
`upstreamCso`:
- If `upstreamCso.count > 0` for an access point with `tags` containing
  `'swimming'`, override status to `caution` (not `danger` — bacteria is
  not a drowning risk; just a swim risk).

**Tests**

`lib/safety/upstream-cso.test.ts`:
- Outfall west of location: counted as upstream
- Outfall east of location: not counted
- Outfall outside 48h window: not counted
- Outfall on non-mainstem body: not counted
- Empty result: returns count=0

**Success**
- pnpm tsc / lint / test clean
- For a location like Pony Pasture (lng ≈ -77.515): all outfalls with
  lng < -77.515 within last 48h are counted upstream
- For Pump House (lng ≈ -77.553, furthest west on the dashboard's locations):
  fewer upstream outfalls than Pony Pasture (it's upstream of more outfalls)

---

## Sub-goal 84 — UI: per-tile + per-detail + metro

**Why:** Make the data visible.

**UX direction (confirmed by user):** Mirror the water-quality pattern
exactly. NO map UI anywhere — no Mapbox, no embedded EmNet iframe, no
spatial diagrams. The EmNet map is our data source via headless browser;
users never see it inside our app. The upstream/downstream relationship
lives in code (longitude comparison) and surfaces in the UI as plain
text + count + amber-color cue, identical vocabulary to water quality.

Pattern alignment:

| Surface          | Water Quality (existing)        | CSO (this sub-goal)              |
|------------------|----------------------------------|----------------------------------|
| Metro            | (n/a — per-station only)         | Aggregated count + caution copy  |
| Tile badge       | WaterDropBadge (safe/caution)    | Small adjacent badge — amber     |
| Detail panel     | WaterQualityPanel                | UpstreamCsoPanel (parallel)      |

**Deliverables**

`components/tiles/RiverLevelTile.tsx`:
- When `location.upstreamCso` is non-null and `count > 0`, render a small
  "CSO" badge next to the WaterDropBadge — amber color (same token as
  WaterDropBadge's caution state), `aria-label="CSO event upstream in
  past 48h"`. Icon shape MUST differ from the water-drop so colorblind
  users can distinguish (WCAG 1.4.1 — same discipline as sub-goal 73).
  Suggested glyph: a triangle or "!" inside an amber circle.

`components/location/UpstreamCsoPanel.tsx` (new — patterned on
`components/location/WaterQualityPanel.tsx`):
- Renders on `/locations/[slug]` detail page when there's an upstream
  CSO signal. Returns null otherwise (same null-render pattern as
  WaterQualityPanel for off-season).
- Header: "Combined Sewer Overflow upstream"
- Plain-language explanation paragraph: "Combined sewer overflows
  discharge into the James River during heavy rain. When an outfall
  upstream of this location releases, bacteria (E. coli, Enterococci)
  spike here for about 48 hours. Levels can be elevated even if the
  river looks clear."
- List of upstream outfalls with most-recent timestamps (compact,
  like WaterQualityPanel's reading list)
- Attribution footer: "Source: City of Richmond DPU / EmNet realtime
  monitoring" with a small outbound text link to the EmNet map for
  users who want to verify (same role as the "James River Watch"
  attribution on WaterQualityPanel — text-link only, no embed)

`components/metro/MetroSummaryPanel.tsx`:
- When ANY location has upstream CSO, render an amber-tinted block
  above the AI summary: "X CSO outfalls discharged in the last 48
  hours. Swim with caution at all downstream access points."
- Use the same amber/caution token as the tile badge for visual
  consistency.

**Tests**

- 2 component tests covering visible state when signal present vs absent
- a11y: `aria-label` on the tile badge; sr-only descriptive text on the
  panel

**Success**
- pnpm tsc / lint / test clean
- Visiting `/?date=<today>` shows the metro warning if there's an active
  upstream event from the emnet ingest
- `/locations/pony-pasture` shows the UpstreamCsoPanel if there are
  upstream events from outfalls west of Pony Pasture's lng

---

## Sub-goal 85 — AI prompt extension + verification

**Why:** Make the AI reason about CSO upstream context.

**Deliverables**

`lib/ai/system-prompt.ts` — append to cached system block:

```
## Combined Sewer Overflow (CSO) — bacterial safety

The James River's combined sewer system overflows after heavy rain.
When upstream CSO outfalls discharge, bacteria (E. coli, Enterococci)
spike for ~48 hours downstream. The city tracks discharges in real
time at apps.emnet.net.

Per-call input includes `upstream_cso` for each location:
  - `count: 0` — no upstream CSO in past 48h; no impact
  - `count > 0` — bacteria likely elevated; explicitly mention this
    in your reasoning and recommend caution for swimming/wading.
    Reference the most-recent timestamp.

This is INDEPENDENT of gauge level and JRA water quality samples.
Both can be "safe" while a CSO is still active — bacteria don't
manifest in samples for several days.
```

`lib/ai/prompts/interpret-location.ts` + `summarize-metro.ts`:
- Add `upstream_cso` to per-call input schema + buildUserMessage
- Include count + most-recent timestamp + outfall names

`lib/ai/get-or-generate.ts`:
- Add `upstream_cso.count` to `computeLocationHash` — new event triggers
  natural lazy regeneration

`scripts/ai-smoketest.ts` — extend smoketest fixtures:
- Case: upstream_cso.count = 2, recent timestamp — confirm body_md
  mentions "CSO" and "caution"
- Case: upstream_cso.count = 0 — confirm body_md does NOT spuriously
  mention CSO

**Success**
- pnpm tsc / lint / test clean
- Smoketest cache works (creation tokens > 0 on call 1, read tokens > 0
  on call 2)
- Body_md output makes contextually-correct statements about CSO
  presence/absence

---

## Operational setup (human side)

### Cloudflare Workers Paid + Browser Rendering

The headless-browser ingest requires Cloudflare's **Browser Rendering**
feature, which is included in the **Workers Paid** plan ($5/mo).

**Enable:**
1. Cloudflare dashboard → Workers & Pages → Overview → Plans
2. Upgrade to Workers Paid if currently on Free
3. Navigate to Workers & Pages → Browser Rendering
4. Enable it (one-click confirmation)
5. Verify CLI access: `wrangler browser-rendering list` should return a
   non-error response (empty list is fine)

**Cost ceiling:**
- Workers Paid base: $5/mo (10M requests included)
- Browser Rendering: 10 hours of browser time per month included; we use
  ~2 invocations × ~30s each = ~1 minute/day → ~30 min/mo, well under
  the included quota
- No additional cost expected

**Apply migration to production:**

After sub-goal 80, agent commits the migration file. Human applies via
Supabase Studio SQL editor or `supabase db push`. See CLAUDE.md "no model
DB writes" policy.

---

## Critical files

- `supabase/migrations/00NN_cso_outfalls.sql` — schema (sub-goal 80)
- `lib/ingest/cso.ts` — internals replaced (sub-goal 82)
- `lib/ingest/cso-emnet.ts` — new ingest module (sub-goal 82)
- `lib/safety/upstream-cso.ts` — new upstream rules (sub-goal 83)
- `lib/safety/rules.ts` — status override extension (sub-goal 83)
- `lib/queries/today.ts` — LocationSummary extension (sub-goal 83)
- `components/tiles/RiverLevelTile.tsx` — badge (sub-goal 84)
- `components/location/UpstreamCsoPanel.tsx` — detail page (sub-goal 84)
- `components/metro/MetroSummaryPanel.tsx` — metro warning block (sub-goal 84)
- `lib/ai/system-prompt.ts` — CSO reasoning block (sub-goal 85)
- `lib/ai/prompts/interpret-location.ts` — per-call input (sub-goal 85)
- `lib/ai/get-or-generate.ts` — hash extension (sub-goal 85)
- `wrangler.jsonc` — BROWSER binding (sub-goal 81, human-applied)

## What this resolves

- ✅ CSO data is real-time and authoritative (emnet is the city's source)
- ✅ Per-location upstream context — Pump House doesn't get flagged for a
  downstream Manchester outfall
- ✅ AI explanations include CSO when relevant
- ✅ Tile + detail-page surfaces give multiple signals to the user

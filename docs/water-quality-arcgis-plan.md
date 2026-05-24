# RVA James — Replace JRA Water Quality Ingest with ArcGIS FeatureServer

## Context

User reports that despite the Round 1 `lib/ingest/jra.ts` scrape, **no reliable water quality data is visible in the app**. The current scrape targets thejamesriver.org pages but the actual data lives in an interactive ArcGIS map at `thejamesriver.org/james-river-watch/` — the page HTML doesn't contain the readings.

User captured the network traffic when interacting with the map (HAR file). The map is powered by a **public ArcGIS REST FeatureServer** hosted on ESRI's services7 endpoint:

```
https://services7.arcgis.com/9ZKA6C4VwqZYRSvM/arcgis/rest/services/River_Watch_data_with_station_locations/FeatureServer/0/
```

This is a clean, structured JSON API. Replacing the cheerio-based scrape with direct queries against this FeatureServer gives us:

- E. coli and Enterococci bacteria readings (the actual swim-safety indicators)
- Water temperature (resolves an out-of-scope note about `water_temp_f` being null)
- Air temperature, conductivity, turbidity, salinity
- Pre-computed EcoliAverage / EnterococciAverage
- Site conditions free-text notes from volunteers
- Station coordinates, names, and the collecting organization

## Source assessment

**Endpoint:** `https://services7.arcgis.com/9ZKA6C4VwqZYRSvM/arcgis/rest/services/River_Watch_data_with_station_locations/FeatureServer/0/query?f=json&...`

**Fields available** (25 total; the relevant subset):

| Field | Type | Notes |
|---|---|---|
| OBJECTID, GlobalID | identifiers | Use GlobalID for dedup |
| StationName | string | Human-readable, e.g. "Pony Pasture" |
| StationNumber, name | string | Short codes, e.g. "J10" |
| Locality | string | City/county |
| Latitude, Longitude | double | For station-to-access-point mapping |
| Organization | string | Which partner collected (JRA, Rivanna, etc.) |
| BacteriaType | string | Which bacteria measured at this station |
| CollectionDate, CollectionTime, date_Time | string + date | When the sample was taken |
| Ecoli, Enterococci | double | CFU/100mL — the headline numbers |
| EcoliAverage, EnterococciAverage | double | Pre-computed running averages |
| WaterTemperature, AirTemperature | double | °F |
| Conductivity, Turbidity, Salinity | double | Secondary indicators |
| SiteConditions | string (1000 char) | Volunteer's free-text observation |

**Capabilities:** Query is supported (we only need read). 2,000-record max per request, 16,000 with no geometry — vastly more than needed.

**Stations near Richmond (37.5°N, 77.5°W):** Confirmed ~8–10 stations including Rocketts Landing, Rope Swing at Tredegar, Pony Pasture, James River 42nd Street Access, Reedy Creek, plus 3–5 more identified during execution.

**Terms / rate limits:** No explicit rate limit, ToS, or licensing terms are in the layer metadata. Standard ArcGIS Online practice + JRA's published disclaimer apply:

> "JRA makes no warranties, expressed or implied, concerning the accuracy, completeness or suitability of its data. Data is provided as is and JRA assumes no responsibility for any errors, omissions or inaccuracies."

Multiple partner organizations collect the data — they all deserve attribution.

**Seasonal data:** Samples collected Thursdays between Memorial Day and Labor Day. **Critical UI consideration:** from September to May, there's no fresh data. The app must distinguish "stale because off-season" from "stale because something's broken."

## Confirmed decisions

- **Replace, not add.** The existing `lib/ingest/jra.ts` scrape is replaced by an ArcGIS query. Same cron slot (`0 12 * * *`), same `withIngestionRun` wrapper, just a different fetch + parse.
- **Two-table model.** Raw readings go into a new `water_quality_readings` time-series table. Derived advisories continue to use the existing `advisories` table. This split lets us show actual numbers ("E. coli 89 CFU/100mL — within VDH safe range") rather than just status pills, while preserving the existing advisory surface.
- **VDH thresholds for advisory derivation.** Single-sample max: E. coli 235 CFU/100mL, Enterococci 104 CFU/100mL. (These match the existing `thresholds.json` `swim.ecoli_max_cfu_per_100ml` value.)
- **Station-to-access-point mapping is explicit.** Each of our 9 access points (10 with Pipeline Trail) gets zero or more JRA sample stations explicitly assigned by slug. Some access points have a direct station (Pony Pasture); some have a nearest-neighbor (Brown's Island → Rope Swing at Tredegar); some have no nearby station (likely Mayo Island, Pump House — to be confirmed during execution).
- **Seasonal-context UI.** Off-season displays the last available sample with "Last sample: [date] — sampling resumes Memorial Day." Not "stale data" warning.
- **Multi-partner attribution.** Each reading shows the collecting organization. Footer / detail page credits all partners listed by JRA: James River Association, Rivanna Conservation Alliance, Rockbridge Area Conservation, Allegheny-Blue Ridge Alliance, Peninsula Master Naturalists, American Water, Virginia State University, USGS.

## Continues sub-goal numbering: 68 → 73

---

## Sub-goal 68 — Audit existing jra.ts + draft station-to-access-point mapping

**Why:** Two foundations before code lands. Confirm what's currently broken, and decide which JRA station feeds which of our access points.

**Deliverables**

### Audit existing ingest
- Read `lib/ingest/jra.ts`. Document what URL(s) it currently scrapes and what it writes (or doesn't).
- Query hosted Supabase: `SELECT count(*), max(effective_from) FROM advisories WHERE source LIKE 'jra%' OR kind = 'bacterial'`. Report what's actually in the DB today.
- Report findings: is the scrape silently failing, returning zero rows, or producing rows that aren't surfaced?

### Station-to-access-point mapping
- Query the FeatureServer for all distinct stations:
  ```
  GET https://services7.arcgis.com/9ZKA6C4VwqZYRSvM/arcgis/rest/services/River_Watch_data_with_station_locations/FeatureServer/0/query?f=json&where=1%3D1&outFields=StationName,name,Latitude,Longitude,Organization&returnGeometry=false&groupByFieldsForStatistics=StationName,name,Latitude,Longitude,Organization&orderByFields=StationName
  ```
- For each station near Richmond (lat ~37.5, lng ~-77.5), compute great-circle distance to each of our access points.
- Produce `docs/water-quality-station-mapping.md` with:
  - For each of our 10 access points: assigned station(s) by name, distance in miles, why this mapping (direct on-site, nearest-neighbor, upstream/downstream proxy, or "no nearby station — no water quality data").
  - For each Richmond-area station: which access point(s) it serves.
- **Verified mapping (use these `name` codes):**

| Access point | Primary station | `name` | Upstream watch | `name` |
|---|---|---|---|---|
| `pony-pasture` | Pony Pasture | **J23** | Huguenot Flatwater | J24 |
| `belle-isle` | Rope Swing at Tredegar | **J20** | Huguenot Flatwater | J24 |
| `browns-island` | Rope Swing at Tredegar | **J20** | Huguenot Flatwater | J24 |
| `north-bank-trail` | Rope Swing at Tredegar | **J20** | — | — |
| `texas-beach` | James River 42nd Street Access | **J22** | Huguenot Flatwater | J24 |
| `buttermilk-trail` | Reedy Creek | **J21** | — | — |
| `mayo-island` | 14th Street | **J10** | Rockett's Landing (downstream) | J08 |
| `shiplock-trail` | Rockett's Landing | **J08** | — | — |
| `pump-house` | Robious Landing Park | **J26** | — | — (10+ mi upstream, best available proxy) |
| `pipeline-trail` | 14th Street + Chapel Island | **J10 + J41** | — | — |

- **Upstream watch role for Huguenot Flatwater (J24):** A bacterial hit at J24 is a 12–24h leading indicator for downstream access points (Pony Pasture and below). When sub-goal 70 derives advisories, upstream-only hits should produce `severity='low'` advisories labeled "Upstream watch — Huguenot Flatwater" rather than full advisories at the downstream point. Helps families plan ahead without false alarms.
- **Mappings stored in a typed `lib/data/station-mapping.ts` constant** for use in sub-goals 69, 70, and 71. The constant must include:
  - `name` — short code (stable, used as filter key)
  - `displayName` — full station name (used in UI and for fallback when `StationName` is null on records)
  - `bacteria` — array of which bacteria are tested at this station. Possible values: `['ecoli']` (single-bacteria sites — e.g. **J26 Robious Landing Park**, confirmed single-bacteria) or `['ecoli', 'enterococcus']` (dual-bacteria sites). This drives UI labeling in sub-goal 71: `null` enterococcus at a `['ecoli']`-only station renders as **"Not tested at this station"**, not "Sample pending" — which is the framing reserved for stations that DO test it but haven't returned the value yet.
  - The `bacteria` capability is verified per station against historical data — query `water_quality_readings` after sub-goal 69 lands for each station: if a non-null enterococcus value has EVER been recorded, mark it dual; otherwise single. Document the verification source in `lib/data/station-mapping.ts` as a comment per station.

**Success**
- Audit findings documented.
- `docs/water-quality-station-mapping.md` exists with explicit mapping rationale per access point.
- `lib/data/station-mapping.ts` exports a typed mapping consumed by later sub-goals.
- No code changes to ingest yet.

---

## Sub-goal 69 — Schema + ArcGIS ingest

**Why:** Replace the cheerio scrape with a clean JSON API call against a stable schema.

**Deliverables**

### Migration: `supabase/migrations/0011_water_quality_readings.sql`

```sql
create table water_quality_readings (
  id uuid primary key default gen_random_uuid(),
  station_name text not null,           -- e.g. "Pony Pasture"
  station_code text,                    -- e.g. "J10"
  station_global_id text unique,        -- ArcGIS GlobalID for dedup
  organization text,                    -- collecting partner
  latitude double precision,
  longitude double precision,
  collected_at timestamptz not null,
  ecoli_cfu_per_100ml double precision,
  enterococci_cfu_per_100ml double precision,
  ecoli_average double precision,
  enterococci_average double precision,
  water_temp_f double precision,
  air_temp_f double precision,
  conductivity double precision,
  turbidity double precision,
  salinity double precision,
  site_conditions text,
  raw_payload jsonb,                    -- preserve full feature in case fields evolve
  fetched_at timestamptz default now()
);

create index water_quality_readings_station_date_idx
  on water_quality_readings (station_name, collected_at desc);

alter table water_quality_readings enable row level security;
create policy "anon_read" on water_quality_readings for select to anon using (true);
```

### `lib/ingest/jra.ts` rewrite

**CRITICAL — DO NOT FILTER BY `StationName`.** Live verification against the FeatureServer shows that JRA's 2026 records have `StationName: null`, `date_Time: null`, `CollectionDate: null` — only `name` (short code like 'J23'), `Ecoli`, `Enterococci`, and `creationdate` are reliably populated. A `where=StationName IN (...)` filter silently drops every 2026 record. Use the stable `name` short codes instead.

- Remove cheerio scrape logic entirely.
- Fetch from the FeatureServer with explicit `f=json`, filtering by **`name` short codes** from `lib/data/station-mapping.ts` (only the stations we map to our access points):
  ```
  GET .../FeatureServer/0/query
    ?f=json
    &where=name IN ('J08','J10','J20','J21','J22','J23','J24','J26','J41')
    &outFields=OBJECTID,GlobalID,name,StationName,StationNumber,Organization,Locality,Latitude,Longitude,date_Time,CollectionDate,creationdate,Ecoli,Enterococci,EcoliAverage,EnterococciAverage,WaterTemperature,AirTemperature,Conductivity,Turbidity,Salinity,SiteConditions
    &orderByFields=creationdate DESC
    &returnGeometry=false
    &resultRecordCount=2000
  ```
  - Note: sort by `creationdate DESC` (not `date_Time DESC`) so 2026 records with null `date_Time` still surface as latest.
  - Bump `resultRecordCount` to 2000 (we now have ~9 stations × multi-year history).
- **Collected-at fallback chain.** When persisting a reading's `collected_at` timestamp:
  ```ts
  const collectedAt =
    coalesce(reading.date_Time)
    ?? coalesce(reading.CollectionDate)
    ?? coalesce(reading.creationdate)
    ?? null;
  ```
  Persist null only when all three are null (then skip — no usable timestamp).
- **Station-name fallback chain.** When persisting `station_name` (display string), prefer `StationName`, fall back to a lookup from `name` short code → display name (defined in `lib/data/station-mapping.ts`):
  ```ts
  const stationName = reading.StationName ?? lookupStationName(reading.name) ?? reading.name;
  ```
- Zod schema for the response — all of `StationName`, `date_Time`, `CollectionDate`, `StationNumber` are `.nullable()`.
- Sanitize `-9` sentinel for `Ecoli` and `Enterococci` to null (existing logic — keep).
- Upsert by `station_global_id` (GlobalID) — each reading is unique per station per collection event. Re-runs the same day produce 0 new rows.
- `User-Agent: rva-james (mike.garrett@teamcolab.com)` — polite identification.
- Updates from the existing daily noon cron at `0 12 * * *` (no schedule change).

### Update queries
- `lib/queries/water-quality.ts` (new):
  - `getLatestReading(accessPointSlug, date)` — returns the most recent reading from the mapped station(s) for an access point, plus the source organization.
  - `getReadingHistory(accessPointSlug, sinceDate)` — for trend display if we want it later.

**Success**
- Migration applies locally and on hosted Supabase.
- Running the cron route writes ≥1 row per mapped Richmond station.
- Re-running same day produces 0 new rows (`station_global_id` dedup).
- `ingestion_runs` shows `jra` source with `ok=true` and non-zero `rows_written`.
- `getLatestReading('pony-pasture', new Date())` returns a typed reading with bacteria values.
- TSC + lint + build pass.

---

## Sub-goal 70 — Derive advisories from readings + rules-engine integration

**Why:** Translate raw bacteria numbers into the existing `advisories` + rules-engine pipeline so the homepage and AI prompt know about swim risk automatically.

**Deliverables**

- Inside `lib/ingest/jra.ts` (or a `lib/ingest/derive-bacterial-advisories.ts` helper invoked after the readings write):
  - **Three-state classification per reading** (verified against the sub-goal 69 data, where JRA's `−9` sentinel is sanitized to `null`):
    - **No measurement** — both `ecoli_cfu_per_100ml IS NULL AND enterococci_cfu_per_100ml IS NULL`. Skip entirely. Do NOT create an advisory; do NOT mark the location safe. The UI will show the "off-season / no recent sample" state from sub-goal 71.
    - **Exceeds threshold** — `(ecoli_cfu_per_100ml IS NOT NULL AND ecoli_cfu_per_100ml > 235)` OR `(enterococci_cfu_per_100ml IS NOT NULL AND enterococci_cfu_per_100ml > 104)`. Create an advisory.
    - **Within range** — at least one bacteria field is non-null and below its threshold, and no field exceeds. Do NOT create an advisory. Absence + presence-of-recent-reading = "safe."
  - **Explicit null guards in code.** Do not rely on `null > 235` evaluating to falsy. Write:
    ```ts
    const ecoliExceeds = reading.ecoli_cfu_per_100ml !== null && reading.ecoli_cfu_per_100ml > 235;
    const entExceeds   = reading.enterococci_cfu_per_100ml !== null && reading.enterococci_cfu_per_100ml > 104;
    ```
  - **Recency window.** Only generate advisories from readings whose `collected_at` is within the last 14 days. Older readings have effective_to in the past anyway, but generating them clutters the table and the audit log with already-expired rows. Verified against sub-goal 69 data: 5 of 6 named stations have last reading from 2024-09-03 — those should produce zero advisories on first run.
  - **Advisory shape.** Upsert an `advisories` row with:
    - `kind='bacterial'`
    - `severity='medium'` if exceeds threshold, `severity='high'` if levels exceed 2× the threshold (E. coli > 470 OR Enterococci > 208)
    - `headline='Elevated bacteria at [station]'`
    - `body=<reading values + threshold context + sample date>`
    - `effective_from=<reading collected_at>`
    - `effective_to=<reading collected_at + 7 days>` (next sampling cycle)
    - `source='James River Watch — [organization]'`, `source_url='https://thejamesriver.org/james-river-watch/'`
  - **Idempotency.** Compute a stable hash from `(station_global_id, bacteria_type, threshold_band)` and use as the upsert key — re-runs the same day produce 0 new advisory rows.
- Extend `lib/safety/rules.ts`:
  - `bacterialStatus({ ecoli, enterococci })` returns `'safe' | 'caution' | 'unknown'`:
    - Both null → `'unknown'`
    - Either non-null exceeds threshold → `'caution'` (or `'danger'` for 2×)
    - Otherwise (at least one non-null, none exceed) → `'safe'`
  - `combinedLocationStatus` already consumes advisories — verify the new bacterial advisories flow through cleanly.

**Success**
- A fixture reading with E. coli = 500 produces a `medium` severity advisory.
- A fixture reading with E. coli = 80 and Enterococci = 30 produces no advisory; the location shows safe.
- A fixture with E. coli = 500 AND CSO active in last 48h produces `high` severity (combined risk).
- A fixture reading with both `ecoli_cfu_per_100ml = null` and `enterococci_cfu_per_100ml = null` produces no advisory AND does NOT mark the location safe — `bacterialStatus` returns `'unknown'`.
- A fixture reading from 30 days ago (outside the 14-day window) produces no advisory regardless of value.
- Running the helper twice in a row produces 0 new advisories on the second run.
- `pnpm test` passes including new rules-engine cases.

---

## Sub-goal 71 — Surface water quality in the UI with seasonal context

**Why:** Make the data visible to families where they're already looking.

**Deliverables**

### Homepage location cards
- For each `RiverLevelTile`, if a recent reading exists for the mapped station, show a subtle water-quality indicator next to the existing status pill:
  - Safe (within thresholds): small water-drop icon, neutral.
  - Caution (over single-sample max): amber water-drop with tooltip showing values.
  - Off-season (no fresh data): no badge. The status pill alone communicates conditions.

### Location detail pages
- New `<WaterQualityPanel>` component:
  - Headline: "Water Quality at [station name]"
  - Latest reading: E. coli value with VDH context ("Below 235 CFU/100mL — within safe range").
  - Enterococcus rendering is **station-capability aware**:
    - If station mapping has `bacteria: ['ecoli', 'enterococcus']` AND reading has a non-null value → render the value with threshold context.
    - If station mapping has `bacteria: ['ecoli', 'enterococcus']` AND reading is null → render "Sample pending" (it's measured here, just not in this sample yet).
    - If station mapping has `bacteria: ['ecoli']` only → render "Not tested at this station — single-bacteria site" with subtle styling. Don't show a zero, don't show "pending."
  - Secondary stats: water temp, air temp, turbidity, salinity (if non-null).
  - **Volunteer's site conditions** rendered verbatim in quotes with attribution. Do NOT pass through AI.
  - **Site-average comparison** (deterministic, no AI): if `ecoli_average` is non-null and the current `ecoli` is non-null, compute `(current - average) / average` and render one of: "much cleaner than usual" / "cleaner than usual" / "near the site average" / "higher than usual" / "much higher than usual". Display alongside the threshold bar.
  - **Threshold visual**: small horizontal `<HorizontalGauge>` showing current value's position on the 0 → 235 (or 0 → 104) scale. Bar at 0% = obviously safe; bar past 100% = obviously caution.
  - Sample date: "Sampled [N] days ago by [Organization]."
  - Attribution: "Data from James River Watch." Static VDH BAV explainer beneath, one sentence.
- Seasonal context handling:
  - If most recent reading is older than 14 days AND current month is October–May:
    - Header: "Sampling is paused for the season."
    - Sub-text: "James River Watch collects samples Thursdays between Memorial Day and Labor Day. Last sample: [date]. Sampling resumes around Memorial Day."
  - If most recent reading is older than 14 days AND current month is June–September:
    - Show a softer warning: "Most recent sample is [N] days old — typical sampling cadence is weekly."

### Footer attribution
- Add a "Water quality data" credit line listing the partner organizations and linking to thejamesriver.org/james-river-watch/.

**Success**
- Visit `/` — location cards with a mapped JRA station show the water-quality indicator when data is fresh.
- Visit `/locations/pony-pasture` — the `<WaterQualityPanel>` renders with the latest reading.
- Visit during off-season — the seasonal context message appears, not a "stale data" warning.
- Mobile devtools at 375px: panels read cleanly.
- Lighthouse mobile retained at 100/100/100/100.

---

## Sub-goal 72 — AI system prompt + per-call inputs

**Why:** The AI metro summary and per-location interpretations should know about water quality so they can speak to it accurately ("E. coli at Pony Pasture was 142 CFU/100mL last Thursday — within the VDH single-sample max of 235").

**Deliverables**

- Extend `lib/ai/system-prompt.ts`:
  - New "Water Quality Reference" section with: the VDH thresholds, the seasonal sampling cadence, the multi-partner attribution, instructions to always cite the sample date and station name when discussing bacteria.
  - Updates the per-location encyclopedia entries to list which station(s) feed each access point.
- Extend `lib/ai/prompts/summarize-metro.ts` and `lib/ai/prompts/interpret-location.ts` per-call input:
  - For each location, include the latest reading (or null + last-sampled-date if off-season).
- Hash these into the `prompt_hash` so cached summaries invalidate when bacteria values change.

**Success**
- AI smoketest produces interpretations that mention bacteria values where appropriate, citing the sample date and station.
- Cache invalidates correctly when readings change.

---

## Sub-goal 73 — A11y, modern-web-guidance pass, perf verification

**Why:** New UI surfaces (water quality panel, attribution footer, off-season messaging) deserve an a11y check and Lighthouse pass.

**Deliverables**

- For the new `<WaterQualityPanel>`, run `npx -y modern-web-guidance@latest search` for relevant patterns (data presentation, status indicators, attribution).
- Keyboard walkthrough: tab to attribution links, focus visible, Enter activates.
- Screen reader pass on `/locations/pony-pasture`: bacteria values are announced with units and context, not just numbers.
- AA contrast verified programmatically on every new color × background pair.
- Lighthouse mobile against the live URL post-deploy: still 100/100/100/100.

**Success**
- All four checks pass. No regression.

---

## Execution rules for the agent

- Run 68 → 69 → 70 → 71 → 72 → 73 in order.
- **After sub-goal 68:** stop and confirm the station-to-access-point mapping. The user is the local expert and may want to adjust some mappings (e.g., Mayo Island has no nearby station — confirm with the user before treating it as "no data" vs. "use Rocketts Landing as a downriver proxy").
- **After sub-goal 69:** stop and verify a real ArcGIS query against the live FeatureServer writes the expected rows. Don't proceed to advisory derivation if the raw data isn't landing.
- Polite scraping: even though this is a JSON API not HTML scraping, identify with a custom `User-Agent` and don't poll more than daily.
- All AI prompt changes invalidate the cached system prompt once on first call after deploy. Acceptable cost.
- Use `git` for all changes; commit per sub-goal.
- Single deploy at the end of the round.
- Do not modify the existing `advisories.kind` enum unless adding a new value requires a migration — `bacterial` is already a valid kind from Round 1 schema.

## Critical files

- `lib/ingest/jra.ts` — sub-goal 69 (rewrite)
- `lib/ingest/derive-bacterial-advisories.ts` — sub-goal 70 (new, optional helper)
- `lib/queries/water-quality.ts` — sub-goal 69 (new)
- `lib/data/station-mapping.ts` — sub-goal 68 (new, typed constant)
- `lib/safety/rules.ts` and `lib/safety/thresholds.json` — sub-goal 70 (extend `bacterialStatus`)
- `lib/ai/system-prompt.ts` — sub-goal 72 (water quality reference section)
- `lib/ai/prompts/summarize-metro.ts`, `lib/ai/prompts/interpret-location.ts` — sub-goal 72 (per-call inputs)
- `supabase/migrations/0011_water_quality_readings.sql` — sub-goal 69 (new)
- `components/tiles/RiverLevelTile.tsx` — sub-goal 71 (add water-quality indicator)
- `components/location/WaterQualityPanel.tsx` — sub-goal 71 (new)
- `components/legal/DisclaimerFooter.tsx` — sub-goal 71 (attribution)
- `docs/water-quality-station-mapping.md` — sub-goal 68 (new, decision artifact)

## What this round resolves

- ✅ Out-of-scope note: "`water_temp_f` null for both gauges" — JRA readings include WaterTemperature, used as a fallback when the USGS upriver gauge doesn't report 00010. Even better than the Cartersville proxy currently noted in the reconciliation.
- ✅ The user-stated gap: "I haven't seen any reliable data in the app yet for water quality."
- ✅ The existing `lib/ingest/jra.ts` cheerio-based scrape is replaced with a structured JSON API call against a known-stable Esri FeatureServer.
- ✅ JRA + multi-partner attribution surfaced where it belongs (data is volunteer-collected, deserves credit).

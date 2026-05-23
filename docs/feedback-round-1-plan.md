# RVA James — Feedback Round 1 Plan

## Context

App shipped to `https://rvajames.org`. This round of post-launch feedback covers four areas of UX and content, plus two architectural shifts that fall out of the UX direction:

1. A second USGS gauge (the city sits *between* the two gauges, so a metro-level view makes more sense than a single-station readout).
2. A filter UX overhaul (form pattern, submit button, loading state, "none" option for youngest child).
3. An AI-generated overall James River summary at the top of the homepage.
4. Official resource links per location.

**Architectural shifts driven by this work:**
- **Lazy AI generation.** Current cron generates 45–60 AI interpretations daily at fixed cost regardless of traffic. At early-stage traffic that's pure waste. Switch to on-demand generation cached in Supabase. The existing prompt-hash dedup + UNIQUE constraint protects against duplicate work.
- **Deterministic location cards on the homepage.** AI is reserved for the metro summary and per-location detail pages. Homepage cards render computed status pills from a rules engine (`lib/safety/rules.ts`) that already exists implicitly in the cached system prompt. Net effect: homepage visit costs 1 AI call instead of 10.

This plan converts everything into **six sequenced sub-goals**. **Execute in order: 23 → 24 → 25 → 26 → 27 → 28.** Each gates the next.

## Confirmed scope decisions (from user)

- Pull **gage height (parameter 00065) at both stations** — 02037500 (upriver) and 02037705 (downriver). Same parameter both sides for direct comparison.
- The **"none" age option generates a general-audience AI interpretation** — treated as a 6th age bucket. Lazy generation, so the cost is paid only if a visitor actually selects it.
- **Agent picks sensible default resource links** per location from rva.gov parks pages, James River Park System, JRA, and similar official sources.
- **AI generation is lazy, not cron-driven.** Kill Goal 10's daily interpret cron. Replace with `getOrGenerate(...)` invoked from page render with the result persisted in Supabase. First visitor for a given `(date, location, age_bucket, prompt_hash)` pays the generation cost; everyone after that hits the cache.
- **Homepage location cards are deterministic.** No AI on the overview. Status pill (`safe`/`caution`/`danger`) + short label + tooltip showing the rule that produced it.

## Cross-cutting concerns

- The cached AI system prompt (Goal 9) will be edited by Sub-goals 23, 25, and 26. Cache invalidation happens automatically on first call after each edit — one-time cache-creation cost, then back to cache reads. Re-run the smoketest at the end of each goal to confirm `cache_creation_input_tokens > 0` on call 1, `cache_read_input_tokens > 0` on call 2.
- Schema migrations follow the established `000N_*.sql` numbering. Each new migration is additive — no destructive changes to existing tables.
- All AI generation must use prompt-hash dedup. Concurrent-write race is handled by the UNIQUE constraint on `(date, location_id, age_bucket, prompt_hash)` (or the equivalent for metro summaries) — second writer's insert fails, second reader gets the first writer's row.
- New cost model: ≈ $0.002 per cold homepage visit (1 metro call), ≈ $0.002 per cold detail-page click (1 location call). At 100 visits/month with 1.5 detail clicks each (50% cache miss): ~$5/year total. Below the cron baseline.

---

## Sub-goal 23 — Two-gauge ingestion + metro river segment

**Why:** The city of Richmond and most river-access locations sit *between* 02037500 (Westham, upriver) and 02037705 (Richmond Locks, downriver). A single-station readout misrepresents conditions for the middle. This is foundational to every later goal.

**Deliverables**
- `supabase/migrations/0003_river_gauges.sql`:
  - Extend the `locations` table with a `kind` column (enum: `'gauge' | 'access_point'`, default `'access_point'`).
  - Insert two new `locations` rows of kind `'gauge'`: `usgs-02037500` (Westham) and `usgs-02037705` (Richmond Locks). Backfill `kind = 'access_point'` for the existing 9.
- Update `lib/ingest/usgs.ts` to pull station list from `locations where kind = 'gauge'`, fetch gage height (00065) for each, and write one `conditions_snapshots` row per station per fetch. Keep the existing 02037500 data continuous — do not delete or backfill historical rows.
- Update `wrangler.jsonc` triggers — no schedule change needed, just verify the cron still resolves both stations.
- Update the cached AI system prompt (`lib/ai/system-prompt.ts`):
  - Replace any "the river gage" / "distance from gage" framing with a two-gauge model.
  - Add a "Metro river segment" section: the city sits between the two stations; conditions at access points are best inferred by considering both, with a note on directional flow.
  - Update each of the 9 access-point entries with `distance_from_upriver_gauge` and `distance_from_downriver_gauge` (rough miles).
- Add `lib/queries/river-segment.ts` exposing `getMetroRiverState(date)` that returns the latest snapshot from both gauges plus a simple delta/average.

**Success**
- `supabase db reset` applies cleanly through 0003.
- `select count(*) from locations where kind = 'gauge'` = 2.
- USGS cron run writes 2 snapshot rows per execution (one per gauge), verifiable in `ingestion_runs.rows_written`.
- `getMetroRiverState(...)` returns both gauges in the metro state object.
- AI smoketest re-run: call 1 creates cache, call 2 reads cache, output references both gauges by name.
- `pnpm build:cf` succeeds; `/status` still green for USGS.

**Pause point:** After this sub-goal completes, **stop and ask the user** to verify the new gauge data looks right before continuing.

---

## Sub-goal 24 — Lazy AI generation + deterministic location cards

**Why:** Switches the AI cost model from fixed-cost cron to pay-per-visit, and reserves AI for places it earns its keep (metro summary + detail pages). The homepage location cards become a deterministic triage layer using the safety thresholds that already live in the cached system prompt.

**Deliverables**

*Rules engine*
- `lib/safety/rules.ts`: pure functions encoding the thresholds currently described prose-style in the cached system prompt:
  - `gageHeightStatus(gageFt: number, locationSlug: string): 'safe' | 'caution' | 'danger'`
  - `postRainSwimStatus(rain48hIn: number): 'safe' | 'caution' | 'danger'`
  - `csoAdvisoryStatus(advisories: Advisory[], locationSlug: string): 'safe' | 'caution' | 'danger'`
  - `bacterialStatus(latestCfu: number | null): 'safe' | 'caution' | 'danger' | 'unknown'`
  - `combinedLocationStatus(metro, advisories, locationSlug): { status, label, reason }` — combines all rules and returns the worst status plus a short human-readable reason like `"Gage 8.2 ft — above 7.5 ft swim threshold"`.
- Companion JSON file `lib/safety/thresholds.json` for per-location thresholds (rocks underwater, swim allow/deny, etc.) so the rules engine and the AI prompt reference a single source of truth.
- Update `lib/ai/system-prompt.ts` to import `thresholds.json` and render it into the cached prompt — replaces the prose threshold tables currently inline. AI output and rule output will agree by construction.

*Lazy AI generation*
- `lib/ai/get-or-generate.ts`: `getOrGenerate({ kind, date, locationId?, ageBucket, contextInputs })`
  - Computes `prompt_hash` from normalized context.
  - SELECT from `ai_interpretations` (or `metro_summaries`, depending on `kind`) by the unique key. If found → return.
  - If not found → call Anthropic with the cached system prompt + per-call inputs, INSERT result, return.
  - On concurrent-write UNIQUE conflict → SELECT and return the winning row.
  - Handles Anthropic API failure: return the most recent prior row for that key (stale-while-revalidate), or `null` with an error code if nothing exists.
- All call sites of per-location interpretations move to `getOrGenerate`.
- **Kill the interpret cron.** Remove the cron trigger from `wrangler.jsonc`, delete `app/api/cron/interpret/route.ts`, delete `lib/ai/generate.ts` (or refactor its useful bits into `get-or-generate.ts`).
- Update `/status` page to remove the "last interpret cron run" row; replace with "ai_interpretations row counts (last 24h)" derived from `ai_interpretations.created_at`.

*Deterministic location cards*
- Refactor `components/location/LocationCard.tsx` (or create it if it's currently embedded in `app/page.tsx`):
  - Props: `location`, `metroState`, `advisories` (all server-rendered, no AI).
  - Calls `combinedLocationStatus(...)` from the rules engine.
  - Renders: location name, status pill (semantic safe/caution/danger color), short label, "Learn more →" link to `/locations/[slug]`.
  - Tap/hover tooltip on the pill shows the `reason` string.
  - No AI imports, no loading state needed for the card itself.

**Success**
- Grep confirms no cron entry for interpret in `wrangler.jsonc`; `app/api/cron/interpret/route.ts` no longer exists.
- `lib/safety/rules.ts` has unit tests (Vitest or similar) covering each threshold function with at least 3 cases each (under, at, over).
- Manually visit `/locations/belle-isle` → `getOrGenerate` triggers on first hit, persists, second hit reads from cache (verify via DB row count and Anthropic dashboard).
- LocationCard renders for all 9 access points using rules only (no AI imports — verify by grepping the component).
- `/status` shows the new row counts; no "interpret cron" rows.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` all pass.

---

## Sub-goal 25 — Filter UX overhaul (form pattern + "none" option)

**Why:** Current filters auto-sync every change via `nuqs`. Users want to change two fields before triggering a refetch, see a loading indicator while data updates, and have a "none" option that bypasses age-tailoring.

**Deliverables**
- `supabase/migrations/0004_age_bucket_none.sql`:
  - Extend the `age_bucket` enum to include `'none'` (alongside `0-2 / 3-5 / 6-9 / 10-13 / 14+`).
- Refactor `components/filters/`:
  - Replace direct `nuqs` writes with local component state for both controls.
  - Add a "Show conditions" submit button. Disabled until at least one value has changed from the URL state.
  - Submit handler commits both values to the URL in a single navigation.
  - Display a clear loading state on the dashboard while the new params resolve (use `useTransition`'s `isPending` around the navigation).
  - `AgeBucketSelect` adds a "No youngest child / show me everything" option mapped to `'none'`.
- Update the cached AI system prompt to add a "General audience guidance" section: when bucket is `'none'`, omit child-specific framing; describe conditions and activities for a generic family/adult audience grounded in NPS/USCG/AAP norms where they apply universally.
- Update the disclaimer microcopy on each tile to suppress the "Use your judgment with kids" line when the bucket is `'none'`.
- Note: with lazy generation (Sub-goal 24) the loading state is **real** — selecting an uncached combo will actually wait for Anthropic. Make sure the pending UI lasts long enough to be visible (skeleton states acceptable).

**Success**
- `pnpm dev` → changing date OR age does NOT refetch until submit button is pressed.
- After submit on an uncached `(date, age)` combo, the dashboard shows a pending/loading state until generation completes.
- Selecting "No youngest child" + submit renders the dashboard without child-specific microcopy.
- Manually visit `/locations/belle-isle?age=none` → `getOrGenerate` produces a general-audience interpretation; second visit reads from cache.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` all pass.
- Smoketest: AI cache still active after system prompt edit.

---

## Sub-goal 26 — AI overall James River summary (lazy)

**Why:** A metro-level summary at the top of the homepage that responds to the selected age bucket gives users an at-a-glance read on river-wide conditions and folds in the "best bets today" recommendations that used to need their own tile.

**Deliverables**
- `supabase/migrations/0005_metro_summaries.sql`:
  - Add `metro_summaries` table mirroring `ai_interpretations` columns but keyed by `(date, age_bucket, prompt_hash)` only — no `location_id`. Same dedup pattern, same UNIQUE constraint.
- `lib/ai/prompts/summarize-metro.ts`: new per-call prompt that takes the metro river state (both gauges), the day's weather, all active advisories, and the age bucket, and produces:
  - `headline`: 1 sentence, ≤ 90 chars
  - `body_md`: 2–3 paragraphs, brand voice
  - `top_concerns`: string[] (≤ 3 items)
  - `best_bets_today`: array of `{ location_slug, reason }` (≤ 3 items) — replaces the standalone TopRecommendationsTile from Goal 11
  - `disclaimer_kind`: enum signaling which microcopy variant to show
- Extend the cached system prompt with a "Metro summary instructions" section — voice, length constraints, required citations, the JSON output schema.
- Extend `getOrGenerate` (from Sub-goal 24) to handle `kind: 'metro'` — same lazy pattern, writes to `metro_summaries`. Default Haiku; escalate to Sonnet only when any active advisory has `severity ∈ {high, extreme}`.
- Add `lib/queries/metro-summary.ts` exposing `getMetroSummary(date, ageBucket)` that internally calls `getOrGenerate`.
- Audit `app/page.tsx` for the Goal 11 `TopRecommendationsTile` — delete it. Its job moves into `MetroSummaryPanel` via the `best_bets_today` field.

**Success**
- Manually visit `/` for the first time today with a fresh age bucket → metro summary generates, persists to `metro_summaries`, renders on the page.
- Manually rerun the same visit → 0 new rows (prompt-hash dedup proven).
- Visit with a different age bucket → 1 new row.
- The smoketest exercises the new metro-summary prompt and confirms cache read on second call.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` all pass.

---

## Sub-goal 27 — Homepage redesign (metro top + deterministic cards)

**Why:** Resurface the data hierarchy: river-wide context first (with the lazy AI summary), location-specific status grid underneath (deterministic).

**Deliverables**
- `app/page.tsx`: restructured into two regions, wrapped in appropriate `<Suspense>` boundaries so the deterministic parts render instantly.
  - **Metro region (top):**
    - `components/banners/FloodBanner.tsx` (existing) stays at the very top.
    - `components/metro/RiverSegmentPanel.tsx` — both gauges with names, current gage heights, delta from 7-day median, last-updated. Deterministic, renders instantly.
    - `components/metro/MetroSummaryPanel.tsx` — renders the AI metro summary from Sub-goal 26 with headline, body, top concerns, best-bets-today, and the appropriate disclaimer microcopy variant. **Wrapped in `<Suspense>` with a skeleton fallback** so the rest of the page is interactive while AI streams in.
  - **Locations region (below):**
    - 9 `components/location/LocationCard.tsx` cards (from Sub-goal 24).
    - Each card renders deterministic status pill + label + tooltip + "Learn more →" link.
    - Cards with active high-severity advisories sort to the top and render with `danger` semantic color.
- Mobile-first layout policy (Goal 3) preserved — single column at 375px, two-column at `md` for the location grid.
- Audit Goal 11's at-a-glance tiles. Preserve `RiverLevelTile`, `WaterTempTile`, `WeatherTile`, `AdvisoriesBanner` if they're still useful — they can fold into `RiverSegmentPanel` as secondary stats. Delete the standalone `TopRecommendationsTile` (folded into metro summary in Sub-goal 26).

**Success**
- `pnpm dev` → `/` renders: flood banner (if any) → river segment panel (instant) → metro summary (streams in) → 9 location cards (instant) in that vertical order.
- Changing date + age via the new form (Sub-goal 25) re-renders the metro summary section with a visible loading state; location cards re-render instantly with new statuses.
- All 9 location cards link correctly to detail pages.
- Cards with active advisories visually surface them; no advisory = no clutter.
- Lighthouse mobile run against the live URL still passes the budget (LCP < 2.5s, CLS < 0.05). LCP element should be in the deterministic part of the page, not the AI summary.

---

## Sub-goal 28 — Per-location resource links

**Why:** Families looking at a specific location should be able to jump to official sources for parking, hours, alerts, programs.

**Deliverables**
- `supabase/migrations/0006_location_resources.sql`:
  - `location_resources` table: `id`, `location_id` (fk), `title`, `url`, `kind` (enum: `'official' | 'parks' | 'safety' | 'community'`), `sort_order`, `created_at`.
- Seed data in the migration with sensible defaults per location. The agent picks them from:
  - rva.gov park/recreation pages
  - James River Park System (jamesriverpark.org)
  - James River Association (thejamesriver.org)
  - NPS or Virginia State Parks where applicable (e.g., Pump House Park history)
  - For each location, aim for 2–4 links spanning at least 2 of the four `kind` values.
  - Use `WebFetch` to verify each URL returns 200 before inserting; record any 404s in the goal's final summary so they can be updated later.
- `components/location/ResourceList.tsx` — renders the links grouped by `kind`, with icons per kind.
- Mount the component on `app/locations/[slug]/page.tsx` below the activity matrix at an anchor `#resources`.
- Expose a "Learn more" link on the homepage `LocationCard` (Sub-goal 24) deep-linking to the resources section (`/locations/[slug]#resources`).
- Update the cached AI system prompt to inform the model that authoritative resources exist per location — this lets it reference "see the parking guide on the location page" rather than fabricating logistics.

**Success**
- `select count(distinct location_id) from location_resources` = 9.
- Every URL in the seed data was verified 200 at seed time (deviations listed in the final summary).
- `/locations/belle-isle` (and any other slug) renders the resource list grouped by kind.
- Homepage card "Learn more" link scrolls to the resources section on the detail page.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` all pass.

---

## Execution rules for the agent

- Run sub-goals in the order listed: 23 → 24 → 25 → 26 → 27 → 28.
- After each sub-goal: run the AI smoketest to confirm prompt cache integrity, run `pnpm tsc --noEmit && pnpm lint && pnpm build:cf`, and report deliverables + verification outputs + deviations.
- Do not deploy after each sub-goal. Run all six locally first, then propose a single deploy at the end. The user will trigger the deploy manually.
- **After Sub-goal 23: pause and ask the user** to verify the new gauge data looks right before continuing to 24.
- **After Sub-goal 24: pause and confirm** the interpret cron is gone and that visiting a detail page lazily generates + caches as expected. The user should sanity-check Anthropic usage in their dashboard.
- If any migration fails to apply against the local Supabase, stop and report — do not attempt destructive workarounds.
- Do not change `tailwind.config.ts`, brand tokens, or fonts unless a UX requirement explicitly demands it.
- When killing files (interpret cron, TopRecommendationsTile), use `git rm` so the deletion is tracked in the commit, not a stray local change.

## Critical files

- [`supabase/migrations/0003_river_gauges.sql`](../supabase/migrations/0003_river_gauges.sql) — sub-goal 23
- [`supabase/migrations/0004_age_bucket_none.sql`](../supabase/migrations/0004_age_bucket_none.sql) — sub-goal 25
- [`supabase/migrations/0005_metro_summaries.sql`](../supabase/migrations/0005_metro_summaries.sql) — sub-goal 26
- [`supabase/migrations/0006_location_resources.sql`](../supabase/migrations/0006_location_resources.sql) — sub-goal 28
- [`lib/ai/system-prompt.ts`](../lib/ai/system-prompt.ts) — edited by 23, 24, 25, 26, 28 (cache rebuilds each time; one-time cost per edit)
- [`lib/safety/rules.ts`](../lib/safety/rules.ts) + [`lib/safety/thresholds.json`](../lib/safety/thresholds.json) — sub-goal 24 (rules engine, single source of truth)
- [`lib/ai/get-or-generate.ts`](../lib/ai/get-or-generate.ts) — sub-goal 24 (replaces cron-based generation)
- [`lib/ingest/usgs.ts`](../lib/ingest/usgs.ts) — sub-goal 23 (two-gauge fetch)
- [`lib/ai/prompts/summarize-metro.ts`](../lib/ai/prompts/summarize-metro.ts) — sub-goal 26
- [`components/filters/`](../components/filters/) — sub-goal 25 (form pattern)
- [`components/location/LocationCard.tsx`](../components/location/LocationCard.tsx) — sub-goal 24 (deterministic)
- [`app/page.tsx`](../app/page.tsx) — sub-goal 27 (homepage redesign with Suspense)
- [`app/locations/[slug]/page.tsx`](../app/locations/%5Bslug%5D/page.tsx) — sub-goal 28 (resource list)
- **DELETED**: `app/api/cron/interpret/route.ts`, `lib/ai/generate.ts`, `components/tiles/TopRecommendationsTile.tsx` (all in sub-goal 24/26)

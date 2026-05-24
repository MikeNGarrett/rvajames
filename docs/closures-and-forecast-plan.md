# RVA James — Round 4: Closures, NOAA Forecast, and Operational Status

## Context

Two structural gaps in the current app that the user surfaced after Round 3 (river-conditions panel redesign):

1. **Forecast blindness.** The app shows current river state with seasonal context (after Round 3), but says nothing about what's predicted in the next 24–72 hours. NOAA's AHPS (Advanced Hydrologic Prediction Service) publishes a forecast hydrograph for the Richmond gauge at `water.noaa.gov/gauges/rmdv2` — structured, public, free.

2. **Operational status blindness.** The app's data model has no concept of "this location or feature is closed." It only knows weather, water, and bacterial conditions. So when RVA.gov announces the Texas Beach pedestrian bridge is out indefinitely, the app cheerfully tells families to go visit Texas Beach. That's an active user-harm bug — the rules engine and the AI system prompt both assume access.

User-shared sources for the operational data:
- water.noaa.gov/gauges/rmdv2 — official, structured, integrate directly
- RVA.gov parks closure pages — official, HTML, scheduled scrape with review queue
- howsthejamesrva.com — unknown existing community dashboard, investigate before assuming relationship
- RVA Trail Report (Facebook / Instagram) — community-curated, **manual digest only** (ToS + brittleness)
- RVA Parks and Rec (Facebook) — same

This round runs **after** the Round 3 river-conditions redesign (sub-goals 35–40). It continues numbering from there: sub-goals **41 → 47**.

## Confirmed decisions (from the user)

- **Closures architecture:** hybrid. Manual admin entry is the source of truth. Automated rva.gov scrape creates **DRAFT** rows that require admin approval before going live. Facebook/Instagram are manual digest inputs — no automation, no scraping.
- **Sequencing:** after Round 3.

## Cross-cutting decisions made in this plan

- **Closures live in their own table**, not as a new `advisories.kind`. Closures are operational state, not time-bounded alerts. Different lifecycle (often open-ended), different surface (banner, not toast), different priority (overrides activity status). Mixing them with weather-style advisories would muddy both.
- **Closures override conditions in the rules engine.** A closed location gets `status = 'closed'` regardless of how nice the weather is. UI cards sort closed-or-restricted locations to the top with a distinct visual treatment (not the regular `danger` color — closures aren't dangerous, they're *unavailable*).
- **Admin auth = Cloudflare Access.** Zero-trust gate at the Cloudflare edge. One env var (`CF_ACCESS_AUD`), Google sign-in, no auth code to maintain in the app. The admin route is `/admin/*` and is unreachable without an Access session.
- **AI system prompt is informed about closures.** The cached prompt gets a "Currently active closures" section so the model doesn't fabricate recommendations for inaccessible locations. This is a small prompt extension and revalidates the cache once on first call after deploy.
- **NOAA AHPS forecast is per-station, jsonb-stored.** No new column proliferation. The forecast object is a typed jsonb blob with a zod schema in the read path. Refresh every hour aligned with the existing NWS cron.

## Execute in order: 41 → 42 → 43 → 44 → 45 → 46 → 47

---

## Sub-goal 41 — howsthejamesrva.com investigation (read-only)

**Why:** Cheapest first move. If they're a friend with a public data feed, we coordinate or consume. If they're abandoned, we know we're filling a need. If they're a parallel commercial product, we know the competitive landscape.

**Deliverables**
- `docs/howsthejamesrva-investigation.md`:
  - Site description: what they show, who runs it, how often it updates.
  - Tech inspection: view-source, look for structured data, an RSS, a JSON endpoint, a `robots.txt`, an `about` or `contact` page.
  - Overlap analysis: which of our 9 access points do they cover? What conditions do they surface that we don't (and vice versa)?
  - Recommendation: ignore, learn-from, contact, or consume.
- No code changes in this sub-goal.

**Success**
- Markdown file committed. Recommendation actionable in one sentence.

---

## Sub-goal 42 — NOAA AHPS forecast ingest

**Why:** Adds the "what will the river do in the next 24–72 hours" dimension. Critical for trip planning.

**Modern-web-guidance guides to retrieve first**
- None directly — this is server-side ingest, not a UI pattern.

**Deliverables**
- `lib/ingest/noaa-ahps.ts`:
  - Fetches the AHPS JSON for gauge `rmdv2` (Richmond / Westham). NOAA exposes structured data at `https://water.noaa.gov/gauges/rmdv2` — investigate the actual JSON endpoint (it's typically `https://api.water.noaa.gov/nwps/v1/gauges/rmdv2/stageflow/forecast` or similar) and confirm shape during execution.
  - Zod schema for the response: `{ generated_at, observations: [{t, stage_ft}], forecast: [{t, stage_ft}], flood_stage_ft, action_stage_ft }`.
  - Writes one row per fetch to `conditions_snapshots` with `source = 'noaa-ahps'` and the full forecast as `payload` jsonb. The existing flat columns (gage_ft etc.) stay null for these rows — they're forecast-only.
- `app/api/cron/noaa-ahps/route.ts`: edge route, guarded by `CRON_SECRET`. Runs hourly aligned with NWS.
- `wrangler.jsonc`: add trigger or piggyback on the existing NWS hourly cron — prefer piggybacking (one less cron).
- `lib/queries/forecast.ts`: `getForecast(date)` returns the most recent forecast snapshot's parsed payload, or null.
- Surface in the Round 3 detail modal (`RiverConditionsDetailDialog.tsx` from sub-goal 39):
  - "Forecast" section with a 72-hour line chart (re-use the `Sparkline` primitive from sub-goal 36; extend it minimally if it can't accommodate a longer time range).
  - Show next-72h high and low predictions.
  - Show "Crossing action stage at ..." or "Crossing flood stage at ..." if the forecast predicts it.

**Success**
- After first cron run: `select count(*) from conditions_snapshots where source = 'noaa-ahps' and fetched_at > now() - interval '2 hours'` ≥ 1.
- `getForecast(...)` returns a typed object with 72h of forecast points.
- Detail modal shows a forecast section with chart + crossing-time text.
- TSC + lint + build pass.

---

## Sub-goal 43 — Operational status schema + rules-engine integration

**Why:** Establishes the data shape closures live in, plus the override semantics in the rules engine. Foundation for sub-goals 44, 45, 46.

**Deliverables**
- `supabase/migrations/0009_location_status.sql`:
  ```sql
  create type location_status_kind as enum ('open', 'restricted', 'closed', 'closed_indefinite');
  create type location_status_state as enum ('draft', 'active', 'expired');

  create table location_status (
    id uuid primary key default gen_random_uuid(),
    location_id uuid not null references locations(id),
    kind location_status_kind not null,
    state location_status_state not null default 'draft',
    affects text,                         -- e.g., "Pedestrian bridge to Texas Beach"; null = whole location
    reason text not null,
    source text not null,                 -- e.g., "rva.gov parks page (2026-05-22)", "Manual entry — admin"
    source_url text,
    effective_from timestamptz not null default now(),
    effective_to timestamptz,             -- null = open-ended
    next_review_at timestamptz,           -- when a human should re-verify
    created_by text not null default 'admin',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index location_status_active_idx
    on location_status (location_id, state, effective_from desc)
    where state = 'active';

  alter table location_status enable row level security;
  create policy "anon_read_active" on location_status
    for select to anon
    using (state = 'active');
  -- service role bypasses RLS for admin writes
  ```
- `lib/queries/location-status.ts`:
  - `getActiveStatuses(date)`: returns active rows for any location where `effective_from <= date AND (effective_to IS NULL OR effective_to > date)`.
  - `getLocationStatus(locationId, date)`: single-location convenience.
- Extend `lib/safety/rules.ts`:
  - `combinedLocationStatus` (existing) now takes an optional `operationalStatus` parameter.
  - When `operationalStatus.kind ∈ ('closed', 'closed_indefinite')`: returns `{ status: 'closed', label: 'Access closed', reason: <closure reason> }` — overriding any weather-based assessment.
  - When `operationalStatus.kind == 'restricted'`: returns the *worse* of the weather status and a `caution` status, with the reason combining both (e.g., "Bridge to Texas Beach out; gage 5.8 ft").
  - When `operationalStatus.kind == 'open'`: no override.
- Add a `'closed'` value to the status union types where they're typed. The semantic-color mapping for `'closed'` is **neutral gray with a lock icon**, not red — closed isn't dangerous, it's unavailable.

**Success**
- Migration applies locally and to hosted Supabase.
- `combinedLocationStatus` Vitest cases extended to cover: open passthrough, restricted-with-bad-weather, closed-override, expired-status-ignored.
- Inserting a fixture closure row makes a location card switch to the "closed" treatment on `/`.
- TSC + lint + build pass.

---

## Sub-goal 44 — Admin UI for manual closure entry

**Why:** The source of truth for closures. Must be fast enough that you actually use it when you see a new closure on Facebook or a news report.

**Modern-web-guidance guides to retrieve first**
- `accessibility` (forms inside admin UI must still be accessible — you may not be the only future admin)
- `autofill-address-form` and other form-guidance entries if relevant to ergonomics
- `accessible-error-announcement` for `:user-invalid` + `aria-invalid` sync on the form

**Auth**
- Cloudflare Access protects everything under `/admin/*`.
- Configure a Cloudflare Access Application in the dashboard (manual step; document in `DEPLOYMENT.md`).
- The app reads the `Cf-Access-Authenticated-User-Email` header in route handlers under `/admin/*` and rejects requests where it's absent.
- Admin user email allowlist via `ALLOWED_ADMIN_EMAILS` env var (comma-separated).

**Routes**
- `app/admin/closures/page.tsx`: list view of active + draft closures, with quick-edit / approve / expire / delete actions.
- `app/admin/closures/new/page.tsx`: form to create a new closure. Fields: location, kind, affects, reason, source, source_url, effective_from, effective_to (optional), next_review_at (optional).
- `app/admin/closures/[id]/page.tsx`: edit existing closure.
- All admin routes are `export const dynamic = 'force-dynamic'` and use the service-role Supabase client.

**UX**
- Form uses `:user-invalid` per the `accessible-error-announcement` guide (sync `aria-invalid` only after blur, not while typing).
- Submit creates `state = 'active'` directly for manual entries (no review queue for your own input — the queue is for scrapes).
- A "duplicate" button on existing closures speeds up entry when the same closure recurs.

**Success**
- Navigating to `/admin/closures` without an Access session returns the Cloudflare Access challenge.
- With a session as an allowed email, the list view renders existing closures.
- Creating a closure for Texas Beach with kind `closed_indefinite`, affects `"Pedestrian bridge"`, and reason `"RVA.gov advisory 2026-05-22"` results in a new row in `location_status` with `state = 'active'`.
- Visiting `/` afterward shows the Texas Beach card with the "Access closed" treatment.
- Visiting `/locations/texas-beach` shows a closure banner with the source attribution.

---

## Sub-goal 45 — rva.gov closure scrape + review queue

**Why:** Catches official updates without requiring you to refresh the rva.gov pages by hand. Always routed through your approval, so a stale HTML structure can't silently publish a wrong closure.

**Deliverables**
- `lib/ingest/rva-closures.ts`:
  - Scheduled scrape of rva.gov parks/recreation pages relevant to our 9 access points. Investigation step at the top of the goal: list the actual URLs and document which ones are useful. Probably one URL per access point or a single closures index.
  - Use `cheerio` (already in the project from prior rounds).
  - For each closure-relevant text block detected, compute a content hash. Compare against the last seen hash for that URL+block.
  - On change: create a `location_status` row with `state = 'draft'`, `source = 'rva.gov parks scrape'`, `source_url = <url>`, with the closure text as the `reason`. The agent doesn't auto-classify `kind` — leave it as a default and let the admin set it on approval.
- `app/api/cron/rva-closures/route.ts`: edge route guarded by `CRON_SECRET`. Runs once daily (closures rarely change hourly).
- `wrangler.jsonc`: new cron trigger.
- Extend `app/admin/closures/page.tsx` with a "Drafts" tab showing pending review items, each with: original text, source URL, "Approve as [kind selector]" + "Discard" buttons.
- An approve action moves `state` from `'draft'` to `'active'` and lets the admin set `kind`, `affects`, and `effective_to` before publishing.

**Success**
- First scrape against the live rva.gov pages produces ≥ 0 draft rows (likely several, including the Texas Beach bridge and Pipeline trail items the user mentioned).
- Admin UI Drafts tab renders them with original text + source link.
- Approving a draft promotes it to active; visit `/` and the affected location card updates.
- Re-running the scrape with no upstream change produces 0 new drafts (content-hash dedup proven).

---

## Sub-goal 46 — Surface closures across the app

**Why:** The data exists from sub-goals 43–45; this round makes it visible to users.

**Deliverables**
- **Location cards on `/`** (`components/location/LocationCard.tsx`):
  - When the location has an active `closed` or `closed_indefinite` status: render with neutral gray, lock icon, and the closure reason in place of the weather-based reason. Sort to the top of the grid.
  - When `restricted`: render in `caution` color with both the operational and weather reasons concatenated.
- **Detail pages** (`app/locations/[slug]/page.tsx`):
  - Persistent banner above the activity matrix showing the closure with `source` attribution and `source_url` linked.
  - The activity matrix renders all activities as `deny` when the whole location is closed.
- **AI system prompt** (`lib/ai/system-prompt.ts`):
  - New "Currently active closures" section, inlined from `getActiveStatuses(today)` at prompt-build time. AI is instructed to never recommend a closed location in `best_bets_today` and to mention the closure if a user asks about that location.
  - This is a one-time prompt-cache invalidation per closure change. Acceptable cost.
- **Metro summary AI prompt input** (`lib/ai/prompts/summarize-metro.ts`):
  - Per-call inputs include the list of currently closed locations. Hash these into `prompt_hash` so closure changes naturally invalidate cached summaries.
- **`/status` page**:
  - Add a "Active closures" panel showing count of active, count of drafts pending review, last scrape time.

**Success**
- Adding a `closed_indefinite` status for Texas Beach via the admin UI causes `/` to show its card with the closure treatment, `/locations/texas-beach` to show the banner, the next AI metro summary to omit Texas Beach from best_bets and reference the closure, and `/status` to show the active count incrementing.
- Removing the closure (expire it or change state to `expired`) reverses all of the above.
- TSC, lint, build, and tests pass.

---

## Sub-goal 47 — A11y + perf verification + modern-web-guidance pass

**Why:** Closures introduce new UI states (neutral-closed treatment, banners, admin forms) that haven't been a11y-audited.

**Deliverables**
- Modern-web-guidance pass: for every new pattern (closure banner, admin form validation, neutral-closed status pill), run a `search` + `retrieve` to confirm we matched the current recommendation.
- Lighthouse mobile against `/` and `/locations/texas-beach` (with an active closure fixture): LCP < 2.5s, CLS < 0.05, Accessibility ≥ 90.
- Keyboard nav through the admin form: tab order, focus-visible, `:user-invalid` triggering only after blur.
- Screen reader: closure banner announces with the proper landmark + heading structure. Admin form errors announce via the synchronized `aria-invalid` pattern.
- Cloudflare Access integration: confirm `/admin/*` is blocked end-to-end from an unauthenticated client.

**Success**
- All four checks pass. Any failure becomes its own follow-up sub-goal.

---

## Execution rules for the agent

- Sub-goals 41 → 47 in order.
- **After sub-goal 41:** stop and report the howsthejamesrva.com findings before continuing. If they have a public data feed worth consuming, the user may want to adjust the plan.
- **After sub-goal 44:** stop and confirm the user has configured the Cloudflare Access Application + ALLOWED_ADMIN_EMAILS env var before testing the admin route.
- **After sub-goal 45:** stop and report the first-scrape draft results. Some will be noise; the user reviews and approves the real ones manually. Do not auto-approve drafts under any circumstance.
- For every modern-web-guidance guide cited in the plan, run `retrieve <id>` before implementing.
- Use `git` for all changes; commit messages cite the sub-goal number.
- Do not modify the Round 3 river-conditions panel or detail modal except where sub-goal 42 adds the forecast section to the modal.
- Do not deploy after each sub-goal. Land all locally; user triggers single deploy at the end.
- Do not introduce a Facebook or Instagram API integration under any version of "let's try it." That's an explicit non-goal.

## Critical files

- `docs/howsthejamesrva-investigation.md` — sub-goal 41
- `lib/ingest/noaa-ahps.ts` — sub-goal 42
- `app/api/cron/noaa-ahps/route.ts` — sub-goal 42
- `lib/queries/forecast.ts` — sub-goal 42
- `supabase/migrations/0009_location_status.sql` — sub-goal 43
- `lib/queries/location-status.ts` — sub-goal 43
- `lib/safety/rules.ts` — sub-goal 43 (override logic) and 46 (closure surfacing)
- `app/admin/closures/page.tsx`, `new/page.tsx`, `[id]/page.tsx` — sub-goal 44 (new)
- `lib/ingest/rva-closures.ts` — sub-goal 45
- `app/api/cron/rva-closures/route.ts` — sub-goal 45
- `wrangler.jsonc` — sub-goal 45 (new cron)
- `components/location/LocationCard.tsx` — sub-goal 46 (closure treatment)
- `app/locations/[slug]/page.tsx` — sub-goal 46 (closure banner)
- `lib/ai/system-prompt.ts` — sub-goal 46 (active closures section)
- `lib/ai/prompts/summarize-metro.ts` — sub-goal 46 (closures in per-call input)
- `app/status/page.tsx` — sub-goal 46 (closures panel)
- `DEPLOYMENT.md` — sub-goal 44 (Cloudflare Access setup steps)
- `SECURITY.md` — sub-goal 44 (admin auth posture)

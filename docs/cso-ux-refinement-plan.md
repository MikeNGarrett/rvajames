# RVA James — CSO UX Refinement Plan

## Context

The CSO/EmNet round (sub-goals 80–85, deployed as Worker version `f421ce7d`)
shipped a working pipeline: EmNet → `cso_outfalls` → `advisories` → per-location
upstream signal → UI surfaces. Smoke test confirmed 22 outfalls catalogued,
5 active mainstem advisories, and correct geographic attribution (Pump House
sees 0 upstream CSOs; downtown-east locations see 1).

User feedback after seeing it live (2026-05-29):

1. **CSO discharge IDs ("CSO 34", "CSO 35") aren't useful in user-facing UI.**
   Aggregate counts are, but only when tied to a specific location or activity.
2. **Active advisories belong at the top of the homepage in plain language**
   with a link out to learn about combined sewer overflows.
3. **CSO advisories on forecast dates are wrong.** Today's surfaces show "active
   now" — but a forecast date should reflect whether that date falls within an
   active advisory's 48h window, with the expected clear time. Age-aware
   messaging is desirable if data supports it.
4. **The "Upstream sewer overflows active" location-page block is great** — but
   surfacing the per-outfall list is noise; the count alone is the signal.
5. **Active events should be visually separated from past events** under the
   residual 48h advisory window — especially in the homepage banner.

## Confirmed scope decisions

- **Sequencing: CSO UX refinement runs BEFORE dynamic-content-loading (63–67).**
  The dynamic-content round migrates the same components this work touches; doing
  dynamic-content first would force a re-touch.
- **"Actively discharging" precision: accept up to ~12h staleness.** Ingest
  cadence stays at twice daily (06:00 / 18:00 UTC — the free-tier cron limit is
  saturated, no slots free). The active-now banner labels itself honestly:
  "Sewer overflow active as of last check (X hours ago)."
- **Age-targeted CSO messaging: messaging-only.** Same advisory data; tone and
  urgency vary per age bucket. 0–2/3–5: "Avoid all water contact through
  <clear-time>." 14+: "Bacterial levels elevated through <clear-time>;
  consider postponing." No new ingestion path, no new external data source.
- **"Learn more" target: `/safety#cso` anchor.** Add a CSO explainer section
  to the existing `/safety` page. We control the copy and can update it as
  Richmond's CSO mitigation work progresses.

## Out of scope

- Increased ingest cadence. Cron slots are saturated; freeing one means
  migrating `usgs-percentiles` to an on-demand API route — a separable change.
  If precision becomes a real complaint, file that as a follow-up round.
- Age-stratified CSO advisories from external sources (e.g., AAP, Richmond DPU
  pediatric guidance). Looked into; doesn't exist in a structured form. Treat
  as a research backlog item, not a launch blocker.
- Map UI for outfall locations. Explicitly rejected by user during sub-goal 84.
- Real-time WebSocket updates. CSO data lags from EmNet anyway; not worth
  the complexity.

---

## Sub-goal 93 — Schema: persist active-overflow state

**Why:** Sub-goals 94 and 95 both need to distinguish "currently discharging"
from "past event under residual advisory." That distinction requires
persisting EmNet's `cso_active_overflow` boolean — currently extracted in
`lib/ingest/cso-emnet.ts` as `overflow: boolean | null` but discarded at
upsert because `cso_outfalls` has no column for it.

**Deliverables**

- `supabase/migrations/0NNN_cso_active_overflow.sql`:
  ```sql
  alter table cso_outfalls
    add column current_overflow boolean,
    add column current_overflow_observed_at timestamptz;

  comment on column cso_outfalls.current_overflow is
    'EmNet cso_active_overflow flag at last ingest. NULL if not yet observed.';
  comment on column cso_outfalls.current_overflow_observed_at is
    'When current_overflow was last refreshed (== last_seen_at on most rows).';

  create index idx_cso_outfalls_current_overflow
    on cso_outfalls (current_overflow)
    where current_overflow = true;
  ```
- Update `lib/ingest/cso.ts` to write `current_overflow` + `current_overflow_observed_at`
  on every upsert. The values come from `EmNetSite.overflow` (existing field).
- Regenerate Supabase types (`pnpm gen:types` or equivalent), commit `lib/supabase/types.ts`.
- Update `docs/audit-reconciliation.md` to mark 93 complete with commit SHA.

**Success**

- Migration applies cleanly to local Supabase (`supabase db reset`).
- **User applies migration to production manually** (agent deny rules block it).
- After next prod CSO cron fire, `pnpm query:prod "select count(*) from cso_outfalls where current_overflow=true"` returns a sensible number.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.
- `pnpm test` passes including `lib/ingest/cso-emnet.test.ts` (extended with a case verifying `overflow` flows through to the row).

**Security**

- This migration only ADDS columns. No data loss path.
- Agent does not apply to prod; user does.

---

## Sub-goal 94 — Query split: active vs. residual + forecast-aware

**Why:** Backend foundation. UI sub-goals (95, 96, 97) need data shaped as:
"what's actively overflowing right now?" and "for the selected date, which
advisory windows include this date?"

**Deliverables**

- Extend `lib/queries/today.ts` `TodayData` shape:
  ```ts
  interface CsoState {
    /** Outfalls where current_overflow=true at last ingest. */
    activelyDischarging: {
      count: number;
      observedAt: string;     // current_overflow_observed_at of most recent
      hoursStale: number;     // (now - observedAt) in hours
    };
    /** Advisory windows that include the selected date (forecast-aware). */
    advisoriesOnSelectedDate: {
      count: number;
      windowEndsAt: string;   // max(effective_to) among matching
      anyAffectsJamesMainstem: boolean;
    };
  }

  type TodayData = {
    // … existing fields …
    cso: CsoState;
    // activeCsoOutfalls is REMOVED — replaced by cso.*
  };
  ```
- Query logic in `lib/queries/today.ts`:
  - `activelyDischarging` joins `cso_outfalls` filtered on `current_overflow = true`
    AND `affects_james_mainstem = true`. Count + most-recent observation timestamp.
  - `advisoriesOnSelectedDate` joins `advisories` (kind='cso_overflow') where the
    selected `dateStr` (interpreted as a full UTC day) overlaps
    `[effective_from, effective_to]`. For observed mode: `dateStr` is today,
    so this matches advisories whose window includes `now()`. For forecast
    dates: matches advisories whose 48h window extends into the future to cover
    the selected date.
- Update `lib/safety/upstream-cso.ts` to accept a `forSelectedDate: string`
  parameter (defaults to "now" behavior to preserve callers during migration).
  When `forSelectedDate` is set, query by date overlap, not `effective_to > now()`.
- Update `lib/safety/rules.ts` to use `cso.advisoriesOnSelectedDate.count > 0`
  as the "upstream CSO present" signal (was: `upstreamCso?.count > 0` at "now").
- Delete `TodayData.activeCsoOutfalls` and `computeActiveCsoOutfalls` (replaced
  by `cso.activelyDischarging`).
- Tests:
  - `lib/queries/today.test.ts` — add cases for observed-today, forecast-within-window, forecast-outside-window.
  - `lib/safety/upstream-cso.test.ts` — add cases for date-overlap mode.

**Success**

- `pnpm test` passes; new cases cover the three observed/forecast variants.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.
- Backward compatibility: existing UI surfaces (which still expect the old shape)
  are updated in this same sub-goal — no half-migrated state. (Acceptable to
  ship as a single commit since types-driven refactor.)
- Manual verification against local Supabase snapshot with prod data:
  - Today: `cso.activelyDischarging.count >= 0` (matches prod row count)
  - Today: `cso.advisoriesOnSelectedDate.count` matches existing 5-row count
  - Tomorrow: `cso.advisoriesOnSelectedDate.count` reflects only advisories
    whose `effective_to` extends into tomorrow

---

## Sub-goal 95 — Top-of-page CSO banner + `/safety#cso` explainer

**Why:** The user-visible payoff. Active CSO state belongs at the top of
the homepage in plain language, not buried in the metro summary AI panel.

**Deliverables**

- `components/banners/CsoBanner.tsx` (new):
  - Two visual states (decided by `cso.activelyDischarging.count > 0`):
    - **Active**: red/orange severity. Copy: "Sewer overflow in progress.
      Avoid the river and any contact with river water. Bacterial contamination
      is elevated."
    - **Residual only**: amber caution. Copy: "Recent sewer overflows in the
      past 48 hours. Bacterial levels likely elevated through
      <clear-time-formatted>."
  - Both states: small "What's a combined sewer overflow?" link to `/safety#cso`.
  - Both states: "Data as of <hoursStale>h ago" microcopy honestly labeling the
    ingest lag.
  - Sticky positioning matching `FloodBanner` pattern.
  - Age-aware copy variant: 0–2/3–5 uses stronger language ("Avoid all water
    contact"); 14+ uses softer ("Consider postponing water contact").
- `app/page.tsx`: render `<CsoBanner cso={data.cso} ageBucket={ageBucket} />`
  above `<FloodBanner>` when `cso.activelyDischarging.count > 0 ||
  cso.advisoriesOnSelectedDate.count > 0`.
- `app/safety/page.tsx`: add a new section with `id="cso"` anchor:
  - "Combined Sewer Overflows in Richmond" heading (h2).
  - 2–3 paragraphs of plain-language explanation: what a CSO is, why
    Richmond's system overflows after heavy rain, why the 48h post-event window
    matters for bacterial levels, what to do if you live near the river.
  - Cite: Richmond DPU (link out to authoritative city page), CDC water
    contact guidance, link to EmNet for real-time map.
  - This is committed prose — review for tone before merging.

**Success**

- Visual review: banner renders cleanly at 375px (mobile-first), both active and
  residual states.
- A11y: banner has `role="alert"` (for active) or `role="status"` (for residual);
  link is keyboard-focusable; color contrast AA across both states.
- `/safety#cso` anchor scrolls to the new section.
- Lighthouse mobile against the preview build: 100/100/100/100 retained
  (banner is small, no JS, no CLS).

---

## Sub-goal 96 — Strip outfall IDs from UI; pivot to counts + context

**Why:** Feedback #1 and #4. Outfall IDs are noise. Counts in context are signal.

**Deliverables**

- `components/location/UpstreamCsoPanel.tsx`: remove the `<ul>` of individual
  outfalls. Keep the count + framing block. Tighten the framing copy to lean
  on count + impact ("3 sewer overflows upstream in the past 48h — bacterial
  contamination may be elevated.").
- `components/tiles/AdvisoriesBanner.tsx`: special-case advisories where
  `source = 'emnet_cso'`. Instead of rendering each as its own headline,
  aggregate them into a single entry: "N upstream sewer overflows in the past
  48h." Click-to-expand details are OK if needed for power users; default-collapsed.
- `components/metro/MetroSummaryPanel.tsx`: if it currently surfaces outfall
  details (via `activeCsoOutfalls`), refactor to use the new `cso` shape from
  sub-goal 94 — counts only, no IDs.
- `lib/ai/system-prompt.ts` + `lib/ai/prompts/interpret-location.ts` +
  `lib/ai/prompts/summarize-metro.ts`:
  - Remove instructions to surface outfall IDs.
  - New instruction: "CSO context is communicated in COUNTS with upstream
    geographic context, never by outfall ID. Phrase like '3 sewer overflows
    upstream' or 'an active sewer overflow', not 'CSO 34'."
  - Update the per-call input schema: CSO context becomes
    `{ activeNow: boolean; upstreamRecentCount: number; advisoryEndsAt: string | null }`
    — no outfall arrays.
  - Update smoketest fixtures to verify the AI never emits "CSO N" in output.
- Tests:
  - `lib/ai/prompts/*.test.ts` — assert outputs don't contain outfall ID patterns.
  - `components/location/UpstreamCsoPanel.test.tsx` — assert no `<li>`s for
    individual outfalls.

**Success**

- Visual review: location detail and homepage no longer show "CSO 34", "CSO 35", etc.
- AI smoketest run (sub-goal 85's smoketest extended with the negative assertion):
  output text contains no "CSO N" pattern, contains the count phrasing.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf && pnpm test` pass.

---

## Sub-goal 97 — Forecast-date handling + age tone polish

**Why:** Feedback #3. Forecast dates should reflect whether they fall within
an active advisory window; age-bucket framing should adjust tone.

**Deliverables**

- The query layer from sub-goal 94 already returns forecast-aware
  `cso.advisoriesOnSelectedDate`. This sub-goal wires that into the UI on
  forecast dates.
- `components/banners/CsoBanner.tsx`: extend with a third visual state for
  forecast mode:
  - **Forecast within advisory window**: amber. Copy: "Sewer overflow advisory
    will be in effect on <date>. Window clears at <effective_to-formatted>."
  - Banner suppresses entirely on forecast dates that fall outside any advisory.
- `app/page.tsx`: gate banner visibility on `data.mode` — observed mode shows
  active/residual, forecast mode shows forecast-window when applicable.
- `lib/ai/prompts/*` — adjust per-call instructions so AI reasoning reflects
  the selected date, not "today." If `data.mode === 'forecast'` and a CSO
  advisory covers the forecast date, the AI should phrase accordingly
  ("By Saturday, a recent sewer overflow advisory may still be in effect").
- Age-aware tone (data-free, copy-only):
  - Banner copy varies per `ageBucket` prop (already passed in sub-goal 95).
  - UpstreamCsoPanel copy varies per `ageBucket`.
  - AI prompts: existing age-band rules cover this; just confirm the CSO
    additions respect the per-age tone established in the system prompt.

**Success**

- Manual test: forecast date 1 day out, with an active CSO whose window extends
  into tomorrow → banner shows forecast-within-window variant.
- Forecast date 5 days out → no banner.
- Age 0–2 vs 14+: visible copy difference (urgency vs. consideration).
- Lighthouse mobile: still 100/100/100/100.
- Final check: AI smoketest with forecast + CSO active fixture — assert
  output references the correct future date and the clear time.

---

## Execution rules

- Run 93 → 94 → 95 → 96 → 97 in order. 93 is the only one needing the user
  to apply a migration (agent denied).
- After sub-goal 93 lands locally and 94 is in progress, **stop and wait
  for the user to apply the migration to prod** before testing the new query
  paths against prod data.
- Single deploy at the end of round (after 97). Same posture as the original
  CSO/EmNet round.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf && pnpm test` after each
  sub-goal.
- Do not regress Lighthouse mobile from 100/100/100/100.
- All shared CSO components (banner, panel, ai prompts) must remain
  accessible: AA contrast across both red/amber states, keyboard navigation,
  aria-live for state changes.

## Critical files

- `supabase/migrations/0NNN_cso_active_overflow.sql` — sub-goal 93 (new)
- `lib/supabase/types.ts` — regenerated, sub-goal 93
- `lib/ingest/cso.ts` — sub-goal 93 (writes new columns)
- `lib/ingest/cso-emnet.ts` — already extracts `overflow`; verify it flows through
- `lib/queries/today.ts` — sub-goal 94 (query split)
- `lib/safety/upstream-cso.ts` — sub-goal 94 (date-overlap mode)
- `lib/safety/rules.ts` — sub-goal 94 (consume new shape)
- `components/banners/CsoBanner.tsx` — sub-goal 95 (new)
- `app/page.tsx` — sub-goals 95, 97 (banner placement + forecast gating)
- `app/safety/page.tsx` — sub-goal 95 (anchor section)
- `components/location/UpstreamCsoPanel.tsx` — sub-goal 96 (kill IDs)
- `components/tiles/AdvisoriesBanner.tsx` — sub-goal 96 (aggregate CSO rows)
- `components/metro/MetroSummaryPanel.tsx` — sub-goal 96 (counts-only)
- `lib/ai/system-prompt.ts` + `lib/ai/prompts/*.ts` — sub-goal 96 (kill ID surfacing)
- `scripts/ai-smoketest.ts` — sub-goal 96 (assert no IDs in output)

## Verification approach (end-to-end, after 97)

1. Apply migration to prod (user-driven).
2. Wait for next prod CSO cron fire (06:00 or 18:00 UTC) so `current_overflow`
   populates.
3. Manual prod check: `pnpm query:prod "select count(*), sum(case when current_overflow then 1 else 0 end) from cso_outfalls where affects_james_mainstem=true"`
4. Local preview against prod-snapshot data: confirm banner state, location
   panel state, AI output text.
5. Deploy.
6. Post-deploy smoke: homepage on prod renders banner if any active advisories;
   `/safety#cso` anchor resolves; forecast-date toggling correctly hides/shows
   banner.

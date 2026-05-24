# RVA James — River Conditions Panel Redesign

## Context

The current `<RiverSegmentPanel>` (`components/metro/RiverSegmentPanel.tsx`) shows accurate raw numbers — 3.69 ft, 1,250 cfs, tidal elevation — but the user has to *know* what those numbers mean. Without seasonal context, "3.69 ft" reads the same whether the river is calm or unusually swollen. That's the problem this redesign solves.

User-stated goals:
1. Show current vs. seasonal average at a glance.
2. Translate the data into experiential context — "what does it feel like to be at the river today?"
3. Lean on visual idioms (gauges, sparklines, colored bands) the way surf and riptide apps do.
4. Push raw detail into a modal or expanded surface so the at-a-glance view stays scannable.

This plan continues the project's sequential sub-goal numbering, starting at **35**.

## Inspiration distilled from surf / riptide / tide apps

Apps studied conceptually (Surfline, Magicseaweed, Tide Times, NOAA marine forecasts). The recurring at-a-glance patterns:

1. **One big headline.** Either a qualitative label ("Fair to Good") or a single numeric ("3–4 ft") — never both fighting for attention.
2. **Qualitative rating with color band.** Tied to a deterministic scoring rubric. Green/amber/red, sometimes with a finer 5-step scale.
3. **Sparkline or arc for time context.** Shows whether you're catching the river on the way up or down.
4. **Secondary stat row with icons.** Three to five chips: wind, swell, water temp, etc.
5. **One-sentence interpretation.** "Fun small waves with a light onshore wind" or "Riptide risk moderate — stay between flags." Always plain language.
6. **Tap to drill in.** Everything else (hourly forecast, model details, source data) lives behind one tap.

Adapted to a river-conditions context: the headline rating answers "is the river calm or running?", the gauge bar shows current relative to seasonal normal, the sentence translates that into rock-hopping and rapids reality, and the modal preserves every raw datum for the curious.

## Confirmed decisions (from the user)

- **Normal-range source:** USGS stat web service. Real historical percentiles (p10/p25/p50/p75/p90) for the day of year, computed from decades of data. Adds one new daily cron ingest.
- **Detail expand pattern:** Native `<dialog>` modal with `closedby="any"` for Esc / light-dismiss / mobile back-gesture handling. Modern-web-guidance recommended.

## Cross-cutting decisions made in this plan

- **Translation sentence is rules-engine-derived, not AI.** Deterministic, always available, no latency, no cost. The existing AI metro summary (Schema B `body_md`) continues to provide richer narration above this panel — the panel itself stays fast and predictable.
- **Pure SVG for all visuals.** No chart library dependency. The gauge bar and sparkline are small, themable via Tailwind, and avoid the hydration weight of recharts/visx.
- **Mobile-first.** All layouts target 375px before scaling up. Hero rating must be readable at arm's length on a phone in sunlight at the river.
- **Hero = upriver gauge only.** The tidal downriver gauge oscillates and has a different datum — it doesn't belong in the "compare current to normal" headline. It lives in the modal as supplementary context.
- **Modern-web-guidance guide references are cited per sub-goal.** Executing agent should `retrieve` each guide before implementing.

## Execute in order: 35 → 36 → 37 → 38 → 39 → 40

---

## Sub-goal 35 — USGS stat service ingestion + percentile schema

**Why:** Unlocks every visual on the new panel — the "current vs. normal" delta, the gauge band markers, the sparkline overlay, the translation sentence's "above/below seasonal average" language.

**Deliverables**
- `supabase/migrations/0007_usgs_percentiles.sql`:
  ```sql
  create table usgs_percentiles (
    id uuid primary key default gen_random_uuid(),
    station_id text not null,           -- '02037500'
    parameter_cd text not null,         -- '00065' (gage height), '00060' (discharge)
    day_of_year smallint not null,      -- 1..366
    p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric,
    record_count integer,               -- years of data behind the percentile
    fetched_at timestamptz default now(),
    unique (station_id, parameter_cd, day_of_year)
  );
  alter table usgs_percentiles enable row level security;
  create policy "anon_read" on usgs_percentiles for select to anon using (true);
  ```
- `lib/ingest/usgs-percentiles.ts`: fetches from `https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=02037500&statReportType=daily&parameterCd=00065,00060`. RDB format is tab-delimited; parse with a zod schema. Writes/upserts 366 rows per parameter per station.
- `app/api/cron/usgs-percentiles/route.ts`: edge runtime, guarded by `CRON_SECRET`, calls the ingest. Runs once per day.
- `wrangler.jsonc`: add trigger `0 3 * * *` (3 AM UTC, after most USGS publishes the daily summary).
- `lib/queries/normal-range.ts`:
  ```ts
  export async function getNormalRange(stationId: string, parameterCd: string, date: Date): Promise<{
    p10: number; p25: number; p50: number; p75: number; p90: number;
  } | null>
  ```
- Use the service-role Supabase client for the write path (RLS gotcha already paid for in prior round).

**Success**
- After first cron run: `select count(*) from usgs_percentiles where station_id = '02037500'` returns ≥ 732 (366 × 2 parameters).
- `getNormalRange('02037500', '00065', new Date())` returns 5 numeric percentiles.
- Re-running the cron same-day produces 0 new rows (upsert semantics work).
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.

---

## Sub-goal 36 — SVG visual primitives

**Why:** Reusable, themable, no dependency. Three small components used by sub-goal 38.

**Modern-web-guidance guides to retrieve first**
- `css` (general modern CSS architecture)
- `css-layout` (for the gauge layout and container queries if needed)

**Deliverables**

`components/ui/HorizontalGauge.tsx`:
- Props: `value: number, min: number, max: number, normalBand: { low: number, high: number }, criticalBand?: { low: number, high: number }`.
- Renders a rounded horizontal bar with:
  - Background = subtle track
  - Normal range shaded (e.g., `bg-surface-accent` ~30% opacity, spanning p25→p75)
  - Critical band shaded danger color if provided
  - Current value as a filled circle/needle marker
  - Optional label markers at min/normal/max
- Pure SVG, ~32px tall, 100% wide.
- ARIA: `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` for the qualitative description.

`components/ui/Sparkline.tsx`:
- Props: `points: { t: number, v: number }[], normalBand?: { low: number[], high: number[] }`.
- 72h time-series line, no axes, no legend.
- Optional shaded normal-range band over the same time axis.
- Current value marker at the most-recent point.
- Pure SVG, ~40px tall, scales horizontally.
- Decorative — `aria-hidden="true"`. The chart's data is announced elsewhere (in the headline + trend arrow).

`components/ui/TrendArrow.tsx`:
- Props: `currentValue: number, valueOneHourAgo: number | null, unit: string`.
- Renders ↑ / ↓ / → with the absolute delta (e.g., "↑ 0.2 ft/h").
- Semantic colors: rising = `caution`, falling = `safe` for swim-relevant params; opposite for kayak-flow params. Caller decides which semantic mapping via a `direction` prop.

**Success**
- All three components render in a Storybook-style page at `/_dev/visuals` (gated by `NODE_ENV !== 'production'`).
- Lighthouse against `/_dev/visuals` passes accessibility ≥ 90.
- Each component has at least 2 Vitest snapshot tests.
- Bundle size: confirm no new npm deps were added.

---

## Sub-goal 37 — Translation engine (rules)

**Why:** Produces the qualitative headline rating + deterministic plain-language sentence the panel reads. No AI, no latency.

**Deliverables**

Extend `lib/safety/thresholds.json` with a `riverState` block:
```json
{
  "riverState": {
    "bands": [
      { "name": "low",      "maxGageFt": 2.5,  "label": "Low & Slow" },
      { "name": "normal",   "maxGageFt": 4.0,  "label": "Calm & Normal" },
      { "name": "elevated", "maxGageFt": 5.5,  "label": "Elevated — Faster Current" },
      { "name": "high",     "maxGageFt": 8.0,  "label": "High & Fast" },
      { "name": "flood",    "maxGageFt": null, "label": "Flood Stage" }
    ]
  }
}
```

Extend `lib/safety/rules.ts`:
```ts
export function riverConditionSummary(input: {
  currentGageFt: number;
  normalRange: { p25: number; p50: number; p75: number } | null;
  rapidsClass: 'I-II' | 'II-III' | 'III-IV' | 'IV-V';
  activeAdvisorySeverity: 'low' | 'medium' | 'high' | 'extreme' | null;
}): {
  band: 'low' | 'normal' | 'elevated' | 'high' | 'flood';
  headline: string;                  // e.g., "Calm & Normal"
  deltaLabel: string | null;         // e.g., "0.4 ft below seasonal median"
  status: 'safe' | 'caution' | 'danger';
  translation: string;               // ≤ 18 words plain language
};
```

Translation templates (deterministic, picked by band × delta-bucket):
- low + below normal: "River is low and slow — rocks exposed at Belle Isle, calm rapids."
- normal + near normal: "River is running normal for the season — typical conditions across access points."
- elevated + above normal: "River is running above seasonal average — faster current, some shoreline rocks underwater."
- high + above normal: "River is high and moving fast — many rocks submerged, rapids more challenging."
- flood: "River is at or above flood stage — keep clear of the riverbanks."

Each template has a children-friendly variant invoked when `ageBucket` is in `0-2 | 3-5 | 6-9`. The render layer passes the active age bucket through.

**Success**
- `lib/safety/rules.test.ts` adds ≥ 15 cases covering each band × delta-bucket combination.
- Manual: for a known gage value (e.g., 3.69 ft) with a known normal range (e.g., p50 = 3.2), `riverConditionSummary` returns `band: 'normal', deltaLabel: '0.5 ft above seasonal median', translation: '...'`.

---

## Sub-goal 38 — `RiverSegmentPanel` redesign

**Why:** The user-facing payoff. All prior sub-goals exist to power this component.

**Modern-web-guidance guides to retrieve first**
- `css-layout` (for the zone structure and container-query responsiveness)
- `accessibility` (for the rating + meter + sentence structure)
- `search-hidden-content` (if any inline expand is used alongside the modal)

**Visual structure (mobile baseline, 375px viewport)**

```
┌─ River conditions ──────────── Updated 12m ago ──┐
│                                                   │
│  [ status pill ]  Calm & Normal                   │
│                                                   │
│  3.69 ft  ↗ 0.5 ft above seasonal median          │
│  [ Class I–II ]                                   │
│                                                   │
│  ┌─ HorizontalGauge ─────────────────────────────┐│
│  │  Low  [▒▒▒NORMAL▒▒▒]  Elev   High      Flood ││
│  │              ●  (current marker)              ││
│  └───────────────────────────────────────────────┘│
│                                                   │
│  ┌─ Sparkline (72h) ─────────────────────────────┐│
│  │  ▒▒▒▒▒▒▒▒▒▒▒▒ normal band ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ ││
│  │  ╱╲___╱─                                       ││
│  └───────────────────────────────────────────────┘│
│                                                   │
│  Rocks at Belle Isle are mostly exposed; rapids   │
│  are running near normal — good for paddlers.     │
│                                                   │
│  💧 Water 68°  ☀ Air 82°  🌊 1,250 cfs  ☂ 0.1 in │
│                                                   │
│  ⓘ More detail →                                  │
└───────────────────────────────────────────────────┘
```

At `md:` breakpoint, the secondary-stat chips can wrap to a single row, and the gauge + sparkline can sit side-by-side.

**Deliverables**
- Rewrite `components/metro/RiverSegmentPanel.tsx`. Keep `MetroRiverState` as the input type. Compose: status pill (from `riverConditionSummary().status`), headline, hero number with `TrendArrow`, rapids class chip (already in the existing component — preserve), `HorizontalGauge`, `Sparkline`, translation sentence, secondary chip row, "More detail →" trigger.
- `lib/queries/river-segment.ts`: extend `MetroRiverState` shape to include:
  - `normalRange`: `{ p10, p25, p50, p75, p90 } | null` for gage height
  - `recent72h`: `{ t: string, v: number }[]` from `conditions_snapshots`
  - `summary`: result of `riverConditionSummary(...)` precomputed server-side
- Each secondary chip uses a lucide-react icon already in the project — no new icon dependency.
- The "More detail →" trigger is a button that invokes the modal from sub-goal 39 via the `popovertarget` / `commandfor` invoker pattern from `declarative-dialog-popover-control` if browser support is acceptable, otherwise a small JS `dialog.showModal()` handler.

**Success**
- `pnpm dev` → `/` renders the new panel instantly (no Suspense wait — all data is deterministic).
- Mobile devtools at 375px: panel reads cleanly, hero number is largest element, sparkline doesn't crowd.
- AA contrast on every text-on-band combo (use `wcag-contrast` to verify, not eyeball).
- ARIA: the `<meter>`/role-meter element is announced as "River level, calm and normal, 3.69 feet of 12" or similar.
- Lighthouse mobile against the live URL after deploy: LCP < 2.5s budget held; CLS unchanged (the panel renders without late shifts because it has no Suspense boundary).

---

## Sub-goal 39 — Detail modal (`<dialog>`)

**Why:** Keeps the at-a-glance view scannable while preserving every datum for users who want the full picture.

**Modern-web-guidance guides to retrieve first**
- `light-dismiss-a-dialog` (use `<dialog closedby="any">` for free Esc + light-dismiss + mobile back-gesture handling)
- `platform-controls-dismiss-dialog` (cross-platform dismissal patterns)
- `declarative-dialog-popover-control` (Invoker commands so no JS is needed to open/close)

**Deliverables**
- `components/metro/RiverConditionsDetailDialog.tsx`:
  - Uses native `<dialog>` element.
  - `closedby="any"` attribute for modern dismissal.
  - The trigger button in `RiverSegmentPanel` uses `commandfor="river-detail-dialog"` and `command="show-modal"` (Invoker commands) — declarative, no `onClick` handler needed for the open path.
  - Inside the dialog:
    - Title: "River conditions detail"
    - **Westham gauge (upriver) section:** current value, discharge, water temp, 7-day chart with full p25–p75 band overlay, USGS station link, last-N-days table (rows: today, yesterday, day before).
    - **City Locks (downriver, tidal) section:** current tidal elevation, datum explanation (NAVD 1988), USGS station link, brief note about tidal cycle.
    - **Weather summary section:** air temp, dew point if available, wind, recent rainfall (24h, 48h, 7d).
    - **Sources & methodology:** USGS station IDs as links, NWS API source, percentile methodology (which years of data the normals reflect), datum disambiguation, refresh cadence.
    - Close button at bottom (in addition to Esc / light dismiss / back gesture).
  - Mobile: dialog is full-width with scroll, not centered.
  - `dialog::backdrop` styled with the existing brand tokens.

**Success**
- Tap "More detail →" → modal opens.
- Pressing Esc closes it. Tapping the backdrop closes it. Mobile back-gesture (test on a real phone or simulator) closes it.
- Keyboard nav: focus moves into the dialog on open, returns to the trigger on close.
- Screen reader: the dialog is announced as a dialog with the title.
- No JS open handler exists if the Invoker pattern works in the target browsers; if browser support is insufficient, fall back to a minimal `useRef + dialog.showModal()` pattern.

---

## Sub-goal 40 — A11y + perf verification + modern-web-guidance pass

**Why:** Sanity-check the new panel and modal against real best-practice before considering this round done.

**Deliverables**
- Run `npx -y modern-web-guidance@latest search "..."` for any pattern used (gauge meter, sparkline, dialog, etc.) and confirm we matched its current recommendations. Update if drift detected.
- Run `lhci autorun --collect.url=https://rvajames.org/` against the live URL post-deploy. Confirm:
  - LCP < 2.5s
  - CLS < 0.05 (no new layout shift from the gauge / sparkline / chip row)
  - Accessibility ≥ 90 (the panel introduced new interactive elements — meter, dialog, button)
- Keyboard-only walkthrough of `/` and the open detail modal. No focus traps lost, no inaccessible interactive elements.
- Screen reader pass (VoiceOver on macOS, TalkBack on Android if available): the rating, hero number, trend, and translation sentence are all announced in a sensible order.
- AA contrast verified programmatically on every new color × background pair.

**Success**
- All four checks pass. Any failure becomes its own follow-up sub-goal, not a band-aid here.

---

## Execution rules for the agent

- Sub-goals 35 → 36 → 37 → 38 → 39 → 40 in order.
- After sub-goal 35: confirm the percentile data actually populated. The USGS stat service can be slow or return inconsistent shapes — wait for one successful cron before continuing.
- After sub-goal 37: write the Vitest cases first, then verify they pass before composing the UI on top.
- For every modern-web-guidance guide cited in this plan, run `retrieve <id>` before implementing the corresponding piece.
- Do not deploy after each sub-goal. Land all six locally, then a single deploy at the end — user triggers it.
- Do not modify the downriver tidal-data ingest path (separate workstream).
- Do not change the AI metro summary (Schema B) — this round is panel-only.
- Use `git` for all changes.

## Critical files

- `supabase/migrations/0007_usgs_percentiles.sql` — sub-goal 35
- `lib/ingest/usgs-percentiles.ts` — sub-goal 35
- `app/api/cron/usgs-percentiles/route.ts` — sub-goal 35
- `wrangler.jsonc` — sub-goal 35 (new cron)
- `lib/queries/normal-range.ts` — sub-goal 35
- `lib/queries/river-segment.ts` — extended in sub-goal 38
- `lib/safety/rules.ts` + `lib/safety/thresholds.json` — sub-goal 37
- `components/ui/HorizontalGauge.tsx` — sub-goal 36 (new)
- `components/ui/Sparkline.tsx` — sub-goal 36 (new)
- `components/ui/TrendArrow.tsx` — sub-goal 36 (new)
- `components/metro/RiverSegmentPanel.tsx` — sub-goal 38 (rewrite)
- `components/metro/RiverConditionsDetailDialog.tsx` — sub-goal 39 (new)
- `app/_dev/visuals/page.tsx` — sub-goal 36 (dev-only showcase, gated by NODE_ENV)

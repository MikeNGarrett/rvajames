# RVA James — Forecast-Aware Date Range + Data-Backed Date Picker

## Context

User reports: "tomorrow shows there's no data." Three issues stack:

1. **The forecast data is ingested but unused by the date-keyed query path.** `lib/queries/forecast.ts` reads NOAA AHPS forecast snapshots (sub-goal 42), but `lib/queries/today.ts`'s `getTodayData(date, ageBucket)` only consults `conditions_snapshots` with observation sources. For any future date, the query returns `hasConditions: false`.
2. **Date picker bounds are hardcoded ±7 days from today**, both in `components/filters/ConditionsForm.tsx:43-44` and `components/filters/DatePicker.tsx:10-11`. This doesn't reflect reality — the AHPS forecast horizon is 72h (not 7 days), and the picker advertises dates we can't serve.
3. **No mode awareness in the UI or AI.** Even if forecast data flowed through, the AI would speak in present tense ("conditions are calm") for a date 2 days in the future, and the UI wouldn't tell the user this is a forecast vs. observation.

### Direction confirmed by the user

**Past data is out of scope.** Historical conditions are a nice-to-have that don't sustain as the dataset grows. The product is about planning *upcoming* trips, not researching past ones. So:

- The picker shows exactly **4 options**: **Today**, **tomorrow's date**, **day +2's date**, **day +3's date**.
- No native `<input type="date">`. A simple chip / button group instead — friendlier on mobile, communicates the available window at a glance.
- Explicit expectation-setting copy: a single subhead tells the user "Today and the next 3 days. Forecast accuracy decreases beyond tomorrow."
- Any URL like `?date=2026-05-22` (past) or `?date=2030-01-01` (beyond horizon) silently redirects to today.

This is a meaningful simplification of the original plan. No three-mode AI prompt (observed/forecast/historical) — just observed (today) and forecast (next 3 days).

## Available data window

Anchored on AHPS (NOAA's hydrologic prediction). Everything else (NWS weather, advisories, closures, percentile context) is available within the same window or longer.

| Source | Horizon (forward of today) | Confidence |
|---|---|---|
| NOAA AHPS gauge forecast | ~72 hours (3 days) | Hydrology model — highest confidence for river level |
| NWS hourly forecast | ~3 days hour-by-hour | High confidence |
| NWS daily forecast | ~7 days summary | Lower past day 4 — not used as canonical |
| Active advisories | Through `effective_to` | Definitive |
| Active closures | Through `effective_to` (often indefinite) | Definitive |
| USGS percentile context | Year-round (seasonal data) | Definitive |

**Picker window = today + 3 forward days.** Past dates are intentionally not selectable.

### Why no past dates

The user's call. Three reasons:

- **Product fit.** The site exists to help families plan upcoming trips. Past-conditions browsing is for hydrologists, not parents.
- **Storage scaling.** Keeping `conditions_snapshots` indefinitely (15-minute USGS, hourly NWS, etc.) grows the table fast. We can implement retention later without losing functionality, since the UI never asks for old rows.
- **Operational simplicity.** No "this might not have data" empty states for past dates. No on-demand USGS historical fetches. One axis of variability removed.

## Confirmed decisions

- **Window is `today` through `today + 3` days. Fixed.** No min query, no historical mode. `lib/queries/date-range.ts` exports `getForecastWindow()` returning a 4-element list of `{ iso, mode, label }` entries for the picker.
- **Forecast data flows through the existing query path.** `getTodayData(date, ageBucket)` becomes mode-aware with two modes: `observed` (today) and `forecast` (any future date in the window). Same return shape, new `mode` field so the UI and AI can adjust.
- **Picker becomes a 4-chip button group.** No native `<input type="date">`. Chips show: `Today`, `[Day, M/D]` for +1, `[Day, M/D]` for +2, `[Day, M/D]` for +3. Tap = navigate. Active chip is visually marked. Minimum 44px touch target per chip.
- **Expectation-setting copy is built in.** A single subhead beneath the picker: "Today and the next 3 days. Forecast accuracy decreases beyond tomorrow." Communicates the data contract without a tooltip or modal.
- **Out-of-window URLs redirect silently to today.** `?date=2026-05-22` (past) or `?date=2026-06-15` (beyond +3) → `redirect('/')` with a subtle notice banner. Defense in depth alongside the chip-only picker.
- **AI prompt gains a "mode" axis with two values.** `observed` (present tense, "conditions are…") and `forecast` (hedged future, "expected to be…", confidence weighted by days-out). Per-call input includes `mode` and `forecast_confidence`. No historical voice needed.
- **Out of scope: past-date browsing in any form.** No on-demand USGS historical fetch. No "yesterday" navigation. No retention policy this round (separate concern; can be addressed later since the UI no longer reads old data).

## Continues sub-goal numbering: 74 → 79

---

## Sub-goal 74 — Forecast window + chip labels

**Why:** Single source of truth for the 4 picker chips. No DB query needed — the window is purely computed from "now" in Richmond time.

**Deliverables**

`lib/queries/date-range.ts` (despite the name, this is now pure computation, not a query):

```ts
export type DateMode = 'observed' | 'forecast';

export interface ForecastChip {
  iso: string;              // 'YYYY-MM-DD' in Richmond time
  label: string;            // 'Today' | 'Mon, May 25' | 'Tue, May 26' | 'Wed, May 27'
  shortLabel: string;       // 'Today' | 'Mon' | 'Tue' | 'Wed' (for narrow screens if needed)
  mode: DateMode;
  daysOut: number;          // 0..3
  forecastConfidence: 'high' | 'medium' | 'low' | null;  // null for observed; high/medium/low for days +1/+2/+3
}

export function getForecastWindow(): ForecastChip[];  // returns exactly 4 entries
export function isInWindow(iso: string): boolean;     // for URL validation
```

Implementation:
- Use Richmond local time (`America/New_York`) for "today." Provide a `lib/utils/date-tz.ts` helper if not already present.
- Compute today and the next 3 dates.
- Format labels with `Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })` → "Mon, May 25".
- Confidence:
  - `daysOut === 0` → `null` (it's observed, not forecast)
  - `daysOut === 1` → `'high'`
  - `daysOut === 2` → `'medium'`
  - `daysOut === 3` → `'low'`

**Success**
- `getForecastWindow()` returns exactly 4 entries.
- First entry's `label === 'Today'`, `mode === 'observed'`.
- Entries 2–4 have day-of-week + date labels, `mode === 'forecast'`.
- `isInWindow('2030-01-01') === false`. `isInWindow(<today's ISO>) === true`.
- Vitest cases cover: timezone edge (day flips at midnight Richmond time), labels formatted correctly.

---

## Sub-goal 75 — Forecast-aware metro & location queries

**Why:** The user-visible bug. "Tomorrow shows no data" is solved here.

**Deliverables**

Refactor `lib/queries/today.ts` `getTodayData(date, ageBucket)`:

- Determine mode at the top using `isInWindow()` + day comparison:
  ```ts
  const todayIso = formatRichmondDate(new Date());
  if (date === todayIso) {
    return getObservedData(ageBucket);
  }
  if (date > todayIso && isInWindow(date)) {
    return getForecastData(date, ageBucket);
  }
  // Past or beyond-window — caller (page handler) is responsible for redirect.
  throw new OutOfWindowError(date);
  ```
- For `mode === 'observed'`: existing behavior unchanged — latest snapshot per gauge.
- For `mode === 'forecast'`:
  - Fetch the most recent AHPS forecast snapshot via `getForecast()` (already exists in `lib/queries/forecast.ts`).
  - Interpolate or pick the forecast point at the target date's noon (a reasonable "what will the river be doing" anchor).
  - Map to the same `MetroRiverState` shape the observed path returns, with the gauge fields populated from the forecast point.
  - For weather (air temp, precip), use the NWS daily forecast snapshot for that date.
  - For advisories/closures: query existing tables with `effective_from <= target_date AND (effective_to IS NULL OR effective_to > target_date)` — they're already date-aware.

Extend `TodayData`:
```ts
export interface TodayData {
  date: string;
  ageBucket: AgeBucket;
  mode: 'observed' | 'forecast';                   // NEW (no 'historical')
  forecastConfidence: 'high' | 'medium' | 'low' | null;  // NEW — null for observed
  locations: LocationSummary[];
  activeAdvisories: ...;
  hasConditions: boolean;
}
```

**Success**
- `getTodayData(tomorrow, '6-9')` returns `hasConditions: true`, `mode: 'forecast'`, `forecastConfidence: 'high'`, with gauge values from AHPS.
- `getTodayData(today + 3, '6-9')` returns `forecastConfidence: 'low'`.
- `getTodayData(today, '6-9')` returns `mode: 'observed'`, `forecastConfidence: null` — identical to current behavior.
- `getTodayData(yesterday, '6-9')` throws `OutOfWindowError`. The page handler catches and redirects.
- Visiting `/?date=<tomorrow>` no longer shows the "no data" empty state.

---

## Sub-goal 76 — 4-chip picker + expectation copy + URL guard

**Why:** Replace the native date input with an explicit 4-chip picker that communicates the data window at a glance. The picker IS the messaging.

**Deliverables**

### New component: `components/filters/ForecastChipPicker.tsx`

Client component using `nuqs` for URL state (consistent with the existing filter pattern).

```tsx
<nav aria-label="Forecast day" role="tablist" className="...">
  {chips.map((chip) => (
    <Link
      key={chip.iso}
      href={withDate(chip.iso)}
      role="tab"
      aria-selected={selectedDate === chip.iso}
      className={cn(
        'touch-target px-4 py-2 rounded-lg text-sm font-medium',
        selectedDate === chip.iso
          ? 'bg-rva-blue text-white shadow-sm'
          : 'bg-surface-raised text-text hover:bg-surface'
      )}
    >
      <span className="block leading-tight">{chip.label}</span>
      {chip.mode === 'forecast' && (
        <span className="block text-[10px] uppercase tracking-wide opacity-70">
          Forecast
        </span>
      )}
    </Link>
  ))}
</nav>
```

Layout:
- Horizontal flex row, 4 chips equal-ish width, ≥44px touch targets.
- On 375px mobile: chips wrap to 2x2 if they don't fit, OR use shorter labels ("Today" / "Mon" / "Tue" / "Wed"). Determine during execution; default to wrap.
- Active chip is `rva-blue` filled; inactive chips are neutral surface.
- Each forecast chip has a small subtitle "Forecast" — communicates the mode without needing a separate badge.

### Expectation-setting copy

Subhead directly beneath the picker. One line, small text, neutral color:

> Today and the next 3 days. Forecast accuracy decreases beyond tomorrow.

Source of truth in `lib/copy.ts` or inlined — small enough that a constant works.

### Server-side URL guard

In `app/page.tsx` and `app/locations/[slug]/page.tsx`. **Preserve all searchParams except `date` when redirecting** — never drop the user's age-bucket selection or any future filter we add:

```tsx
const dateParam = searchParams.date as string | undefined;
const date = dateParam ?? getTodayIso();

if (!isInWindow(date)) {
  const preserved = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'date') continue;
    if (typeof value === 'string') preserved.set(key, value);
  }
  preserved.set('notice', 'date-unavailable');
  redirect(`/?${preserved.toString()}`);  // or '/locations/[slug]?…'
}
```

**Also applies to the `OutOfWindowError` catch block introduced in sub-goal 75.** That handler currently redirects to a bare `/` — update it to the same preserve-searchParams pattern in this sub-goal. Both code paths (the proactive `isInWindow` check above and the reactive catch from a deeper throw) must converge on the same preserve-and-redirect helper. Extract to `lib/utils/redirect-to-today.ts` so the logic lives in one place.

Notice banner component:
- Subtle, dismissible, top-of-page.
- Text: "That date isn't available — showing today's conditions instead."
- Auto-dismisses after 8s OR on next navigation.
- Closeable with Esc or close button.

### Removed code

- `components/filters/DatePicker.tsx` — DELETED. Replaced by `ForecastChipPicker`.
- The `min`/`max` math at `ConditionsForm.tsx:43-44` — removed. `ConditionsForm` now imports and renders `ForecastChipPicker` for the date dimension.

**Success**
- Visiting `/` shows 4 chips: `Today`, `Mon May 25`, `Tue May 26`, `Wed May 27` (or whatever the next 3 days are).
- The "Today" chip is selected by default. Clicking another chip navigates and selects it.
- The chips have visible "Forecast" subtitles on chips 2–4.
- Subhead "Today and the next 3 days. Forecast accuracy decreases beyond tomorrow." renders beneath the picker.
- Visiting `/?date=2030-01-01` → redirects to `/?notice=date-unavailable` with the notice banner.
- Visiting `/?date=<yesterday>` → same redirect.
- Mobile devtools at 375px: chips render correctly (wrapped 2x2 if needed) with 44px minimum touch targets.
- Keyboard navigation: tab between chips, Enter activates.
- Screen reader: chips announce as "tab" / "selected" / their label.

---

## Sub-goal 77 — AI integration for forecast mode

**Why:** When the user selects tomorrow, the AI should say "Tomorrow looks calm" not "Currently calm."

**Deliverables**

### Cached system prompt update (`lib/ai/system-prompt.ts`)

Add a "Date Mode Reference" section:

> **You receive a `mode` field in per-call input. Adapt your language:**
>
> - `'observed'`: speak in present tense. "Conditions are calm today." Headlines reflect current state.
> - `'forecast'`: hedge with confidence. Use "expected", "predicted", "forecast" naturally. Cite the days-out distance.
>   - `forecast_confidence: 'high'` (day +1): "Likely calm tomorrow."
>   - `forecast_confidence: 'medium'` (day +2): "Conditions look calm Tuesday — about 2 days out."
>   - `forecast_confidence: 'low'` (day +3): "Early forecast suggests calm conditions Wednesday, but accuracy decreases that far out — check back closer to your trip."

### Per-call input (`lib/ai/prompts/summarize-metro.ts`, `interpret-location.ts`)

Add to the per-call payload:
- `mode: 'observed' | 'forecast'`
- `forecast_confidence: 'high' | 'medium' | 'low' | null`
- `days_out: number` (0 for today, 1–3 for forecast)

### Hash inclusion

Add `mode` + `days_out` to the `prompt_hash` so a forecast for Saturday generated on Thursday doesn't collide with an observation generated on Saturday.

**Success**
- AI smoketest with `mode: 'forecast', forecast_confidence: 'high'` produces a summary with "tomorrow" / "expected" / "forecast" language.
- Smoketest with `forecast_confidence: 'low'` produces appropriately hedged language.
- Smoketest with `mode: 'observed'` produces present-tense language matching current behavior.
- Cache invalidates correctly when `days_out` changes for the same date (e.g., on Friday a forecast for Saturday becomes an observation for Saturday — separate cache entries).

---

## Sub-goal 78 — Forecast indicators in metro + location panels

**Why:** The picker chips already communicate "this is a forecast." The metro and location panels need a matching, subtle visual cue so the indication is consistent throughout the page.

**Deliverables**

### Metro summary panel

- When `mode === 'forecast'`:
  - Header prefix: "**Forecast for [Day, M/D]**" instead of just the date.
  - Subtle confidence tag below the header: "Forecast confidence: high" / "medium" / "low".
  - A small `(i)` icon next to the confidence tag with tooltip text: "Based on NOAA AHPS river forecast and NWS weather forecast. Accuracy decreases the further out."

- When `mode === 'observed'`:
  - Header: "Conditions today" (current behavior).
  - No confidence tag.

### Location detail page header

Same treatment — `mode === 'forecast'` → prefix the heading with the forecast date and add the confidence tag.

### Notice banner (from sub-goal 76)

Already covered: when redirect-to-today happens, a dismissible banner explains why.

### No other UI changes

The picker chips already carry the "Forecast" subtitle (sub-goal 76). No additional mode badge elsewhere — keeps the page calm.

**Success**
- Visiting `/?date=<tomorrow>` shows the metro panel header with "Forecast for Mon, May 25" and "Forecast confidence: high".
- Visiting `/?date=<today + 3>` shows "Forecast confidence: low" — visually distinct from `high`.
- Tooltip is keyboard-accessible and announces its content to screen readers.
- AA contrast retained on confidence-tag color × background pairs.

---

## Sub-goal 79 — A11y, perf, modern-web-guidance pass

**Why:** New conditional UI (mode chips, banner for out-of-range redirect, picker constraints) and new query paths deserve verification.

**Deliverables**

- `npx -y modern-web-guidance@latest retrieve performance,accessibility` and verify our patterns match.
- Keyboard walkthrough: tab through the picker → date selection → mode chip → tooltip. All focusable, focus visible.
- Screen reader pass on `/?date=<tomorrow>`: the mode is announced ("Forecast for tomorrow"), the forecast confidence is announced.
- Lighthouse mobile against the live URL post-deploy: still 100/100/100/100. The new query paths should not regress LCP — the deterministic content still paints first.
- Verify the AHPS forecast Suspense / lazy AI flow still works for the future-date case.
- Confirm the out-of-range redirect works correctly with the back button (no redirect loop).

**Success**
- All checks pass. No regression.
- Report a brief "what changed for users" summary.

---

## Execution rules for the agent

- Run 74 → 75 → 76 → 77 → 78 → 79 in order.
- **After sub-goal 75: STOP.** Manually verify that visiting `/?date=<tomorrow>` no longer shows the empty state and renders gauge values from the forecast. This is the user's main complaint — confirm it's fixed before moving on to UI polish.
- After every sub-goal: `pnpm tsc --noEmit && pnpm lint && pnpm build:cf`. `pnpm test` where relevant.
- Lighthouse mobile must remain 100/100/100/100 after the final deploy.
- Use `git` for all changes; commit per sub-goal.
- Single deploy at the end of the round.

## Critical files

- `lib/queries/date-range.ts` — sub-goal 74 (pure forecast-window computation; not a DB query despite the name)
- `lib/utils/date-tz.ts` — sub-goal 74 (Richmond timezone helpers, new or existing)
- `lib/queries/today.ts` — sub-goal 75 (mode-aware refactor; throws `OutOfWindowError` for out-of-window dates)
- `lib/queries/forecast.ts` — sub-goal 75 (already exists; called from `today.ts`)
- `components/filters/ForecastChipPicker.tsx` — sub-goal 76 (new, 4-chip button group)
- `components/filters/DatePicker.tsx` — sub-goal 76 (DELETED — replaced by ForecastChipPicker)
- `components/filters/ConditionsForm.tsx` — sub-goal 76 (renders ForecastChipPicker instead of the native date input)
- `components/banners/DateUnavailableBanner.tsx` — sub-goal 76 (new, for redirect notice)
- `lib/utils/redirect-to-today.ts` — sub-goal 76 (new; shared helper that preserves searchParams minus `date` and adds `notice=date-unavailable`)
- `app/page.tsx` — sub-goal 76 (server-side `isInWindow()` guard + uses shared helper; also updates the OutOfWindowError catch from sub-goal 75 to use the same helper)
- `app/locations/[slug]/page.tsx` — sub-goal 76 (same guard pattern + helper)
- `lib/ai/system-prompt.ts` — sub-goal 77 (date mode reference section, observed + forecast)
- `lib/ai/prompts/summarize-metro.ts`, `lib/ai/prompts/interpret-location.ts` — sub-goal 77 (mode + confidence + days_out + hash)
- `lib/ai/get-or-generate.ts` — sub-goal 77 (verify hash includes mode + days_out)
- `components/metro/MetroSummaryPanel.tsx` — sub-goal 78 (forecast header prefix + confidence tag)
- `components/locations/LocationHeader.tsx` (or equivalent) — sub-goal 78 (same)

## What this resolves

- ✅ "Tomorrow shows there's no data." — sub-goal 75 wires the AHPS forecast into the date-keyed flow.
- ✅ Out-of-window date selection. — sub-goal 76 replaces the native date input with an explicit 4-chip picker; server-side redirect catches hand-edited URLs.
- ✅ Expectation-setting copy. — sub-goal 76 includes the "Today and the next 3 days. Forecast accuracy decreases beyond tomorrow." subhead beneath the picker.
- ✅ No "fake current state" for future dates. — sub-goal 77's mode-aware AI + sub-goal 78's panel header indicators make the forecast nature explicit.
- ✅ Past dates excluded by design. — user-confirmed direction; not sustainable as data grows.
- ✅ Storage retention deferrable. — no UI reads past data now, so a retention policy can be implemented later without breaking anything.

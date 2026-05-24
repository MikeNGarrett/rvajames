# RVA James — Richmond Conditions Section

## Context

Today the page has a tiny three-stat row (Water temp · CFS · Rapids class) tucked under the metro summary. It doesn't answer the four questions a parent actually asks when planning a river trip:

1. Is my family going to be happiest swimming, wading, or staying dry?
2. How much do we need to prepare for outdoor conditions today?
3. Is this a good day to stay home or venture out?
4. How long will conditions stay this way — getting better or worse?

This round elevates that row into a proper **Richmond Conditions** section, **placed above River Conditions** (broad context first, river-specific second), with the right metrics to actually answer those four questions visually at a glance.

## Confirmed decisions (from feedback round)

- **Both Swim Today (categorical) and Happiness Index (numeric)** — they answer different sub-questions. Swim Today is swim-specific ("can we get in the water?"). Happiness Index is holistic ("is this a nice day at the river overall?"). Showing both is the user's call; my role is to make sure neither is redundant.
- **Consolidate Feels Like + wet-bulb zone into one stat.** "Feels like 78°F · Heat stress: Normal." The wet-bulb zone (Normal / Caution / Extreme caution / Dangerous) is the actionable part.
- **Hybrid headline.** Deterministic computed headline ("Great day to head out") + AI-written microcopy 1–2 sentences below it.
- **Trends shown as small sparklines, not arrows.** Reuses the `<Sparkline>` primitive from Round 3 sub-goal 36. Shows shape (rising-then-falling, accelerating, plateauing), not just direction.

## Cross-cutting decisions made in this plan

- **One AI call, two consumers.** Extending the existing `MetroSummarySchema` with a new field (`richmond_microcopy: string`) means the Richmond Conditions microcopy and the River Conditions panel both come from a single AI generation. No new API route, no second cache row, no doubled cost. Architecturally the same lazy-AI pipeline.
- **All metrics are deterministic.** Headline, Swim Today, Happiness Index, Feels Like, Heat Stress zone, UV, water quality, next-4h outlook — all computed from the rules engine and `thresholds.json`. AI does narration only.
- **One data addition: UV index.** NWS hourly forecast includes UV — we don't currently ingest it. Small extension.
- **Two computation utilities.** Apparent temperature (heat index for warm; wind chill for cold; NWS standard formulas) and wet bulb temperature (Stull approximation). Pure functions, no new dependencies.
- **Section gets a `<Suspense>` boundary around the AI microcopy only.** Headline and all six stats render instantly from the deterministic side. Only the 1–2 sentence microcopy waits. This keeps the LCP unaffected.

## Continues sub-goal numbering: 80 → 85

---

## Sub-goal 80 — Data additions: UV ingest + heat computation utilities

**Why:** UV is the only new data we need. Apparent temperature and wet bulb are pure computation from data we already have.

### UV index from NWS

NWS hourly forecast (`api.weather.gov/gridpoints/.../forecastHourly` or the dedicated UV endpoint) includes UV index. Extend `lib/ingest/nws.ts` to capture it.

Deliverables:
- Update `lib/ingest/nws.ts` to extract `uvIndex` from the hourly forecast and write it into `conditions_snapshots.payload.uv_hourly` (jsonb).
- No new column needed — the hourly payload already holds variable-shape data.
- Zod schema for the response field.

### Apparent temperature utility

`lib/utils/apparent-temp.ts`:

```ts
/**
 * NWS-standard apparent temperature.
 *   - When T ≥ 80°F and RH ≥ 40%: Heat Index (Rothfusz regression)
 *   - When T ≤ 50°F and wind > 3 mph: Wind Chill
 *   - Otherwise: returns ambient T (no adjustment)
 */
export function apparentTemperatureF(
  ambientF: number,
  relativeHumidity: number,
  windMph: number
): number;
```

Use the published NWS formulas (Rothfusz heat index, NWS wind chill). Documented in source comments with the citation.

### Wet bulb utility

`lib/utils/wet-bulb.ts`:

```ts
/** Stull approximation. Accurate within ±0.5°F for relative humidities 5–99% and temperatures -20 to 50°C. */
export function wetBulbF(ambientF: number, relativeHumidity: number): number;

/** OSHA/NWS heat-stress zones for outdoor activity. */
export function heatStressZone(wetBulbF: number):
  | 'normal'        // < 80°F
  | 'caution'       // 80–85°F
  | 'extreme'       // 85–88°F
  | 'danger'        // 88–90°F
  | 'avoid';        // ≥ 90°F
```

### Tests

Vitest cases covering known input/output pairs from NWS reference tables. Heat index at (95°F, 50% RH) ≈ 107°F. Wind chill at (10°F, 20 mph) ≈ -9°F. Wet bulb at (85°F, 60% RH) ≈ 74°F.

**Success**
- NWS cron run captures `uv_hourly` in the latest snapshot's payload.
- `apparentTemperatureF(95, 50, 5)` returns ~107°F.
- `wetBulbF(85, 60)` returns ~74°F (zone: `normal`).
- All Vitest cases pass.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.

---

## Sub-goal 81 — Rules engine: Happiness Index, Swim Today, 4h outlook

**Why:** Single source of truth for the section's decision logic. All values derived deterministically.

### Extend `lib/safety/thresholds.json`

Add a `richmondConditions` block:

```json
{
  "richmondConditions": {
    "swim": {
      "recommended_min_water_f": 70,
      "wade_min_water_f": 60
    },
    "happinessIndex": {
      "ideal_water_min_f": 72,
      "ideal_water_max_f": 84,
      "ideal_apparent_min_f": 68,
      "ideal_apparent_max_f": 82,
      "bands": [
        { "name": "excellent", "min_score": 80 },
        { "name": "good",      "min_score": 60 },
        { "name": "fair",      "min_score": 40 },
        { "name": "poor",      "min_score": 20 },
        { "name": "avoid",     "min_score": 0 }
      ]
    }
  }
}
```

### Functions in `lib/safety/rules.ts`

```ts
export function swimToday(input: {
  waterTempF: number | null;
  bacterialAdvisoryActive: boolean;
  csoActive48h: boolean;
  floodStage: boolean;
}): {
  status: 'recommended' | 'wade' | 'avoid';
  primaryReason: string;       // one-line, surfaced under the badge
  contributingReasons: string[]; // for tooltip / detail
};
```

Logic:
- `avoid` if `floodStage || bacterialAdvisoryActive || csoActive48h || waterTempF < 60`
- `wade` if `60 ≤ waterTempF < 70` and none of the avoid conditions
- `recommended` if `waterTempF ≥ 70` and none of the avoid conditions
- Null water temp → `wade` with reason "Water temp unavailable — wade with caution"

```ts
export function happinessIndex(input: {
  waterTempF: number | null;
  apparentTempF: number;
  wetBulbF: number;
  precip4hChance: number;      // 0–100
  uv: number;
  advisorySeverity: 'none' | 'low' | 'medium' | 'high';
  closuresAtTopLocations: number;
}): {
  score: number;               // 0–100
  band: 'excellent' | 'good' | 'fair' | 'poor' | 'avoid';
  bandLabel: string;           // e.g. "Good day for the river"
};
```

Scoring (start at 100, subtract):
- Water temp deviation from ideal (72–84°F): linear penalty per degree out of band, capped at -25
- Apparent temp deviation from ideal (68–82°F): same pattern, capped at -20
- Wet bulb zone: normal 0, caution -10, extreme -25, danger -40, avoid -60
- Precipitation 4h chance: -0.3 per percent (so 50% chance = -15)
- UV: ≥8 → -10, ≥10 → -15
- Advisory severity: low -5, medium -15, high -30
- Closures at top river locations: -3 per closure, capped at -15

Map score → band per thresholds.json.

```ts
export function nextHoursOutlook(hourlyForecast: HourlyForecast[], hours: number = 4): {
  precipitationChance: number;  // max within window
  precipitationSummary: string; // e.g. "Clear" | "Showers likely" | "Rain"
  skyCover: 'clear' | 'partly' | 'mostly cloudy' | 'overcast';
  temperatureTrend: 'rising' | 'falling' | 'steady';
  apparentTempTrend: 'rising' | 'falling' | 'steady';
  series: { hourIso: string; ambientF: number; apparentF: number; precipChance: number }[];
};
```

### Deterministic headline

`headlineForRichmondConditions(happinessBand, swimStatus, heatZone)` returns 3–6 words. Decision table:

| Happiness | Swim | Heat zone | Headline |
|---|---|---|---|
| excellent | recommended | normal | "Great day to head out" |
| excellent | recommended | caution | "Good day — manage the heat" |
| good | recommended | normal | "Solid day for the river" |
| good | wade | normal | "Decent day — water's a bit cool" |
| fair | wade | caution | "OK day — pack water" |
| poor | avoid | extreme | "Tough day — limit time outside" |
| avoid | avoid | danger | "Stay home today" |
| ... | ... | ... | ... |

Define the table comprehensively in code; fallback handles unmapped combos.

### Tests

Vitest cases for every band of each function. At least 30 cases total.

**Success**
- `happinessIndex({ waterTempF: 75, apparentTempF: 78, wetBulbF: 74, precip4hChance: 10, uv: 6, advisorySeverity: 'none', closuresAtTopLocations: 0 })` returns score in 80–100 range, band `excellent`.
- `swimToday({ waterTempF: 65, ... })` returns `wade`.
- `swimToday({ waterTempF: 75, bacterialAdvisoryActive: true, ... })` returns `avoid` with bacterial reason.
- `headlineForRichmondConditions('excellent', 'recommended', 'normal')` returns `"Great day to head out"`.
- All Vitest cases pass.

---

## Sub-goal 82 — `<RichmondConditionsSection>` component

**Why:** The visual surface. Six stats + headline + AI microcopy, organized for at-a-glance scanning at 375px.

### Layout (mobile baseline)

```
┌─────────────────────────────────────────────────┐
│ RICHMOND CONDITIONS                             │
│                                                 │
│ 🟢 Great day to head out                        │
│ ╭───────────────────────────────────────────╮  │
│ │ [AI microcopy 1–2 sentences via Suspense] │  │
│ ╰───────────────────────────────────────────╯  │
│                                                 │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│ │ SWIM TODAY │ │ FEELS LIKE │ │ NEXT 4H    │   │
│ │ Recommended│ │ 78°F  ↗    │ │ Clear      │   │
│ │ 72°F · OK  │ │ Heat: Normal│ │ No rain    │   │
│ └────────────┘ └────────────┘ └────────────┘   │
│                                                 │
│ 💧 Water 66°F [▁▂▃▄▅] · 💦 Quality OK ·         │
│ ☀ UV 7 (high) · 🌫 Happiness 82 (Good)         │
│                                                 │
│ ⓘ More detail →                                 │
└─────────────────────────────────────────────────┘
```

At `md:` breakpoint the secondary row stays inline; the primary tile row expands slightly.

### Components

`components/richmond/RichmondConditionsSection.tsx`:
- Top-level wrapper with `<section aria-labelledby="richmond-conditions-heading">`.
- Deterministic headline using `headlineForRichmondConditions(...)`.
- AI microcopy wrapped in `<Suspense fallback={<MicrocopySkeleton />}>`.
- Three primary tiles: `<SwimTodayTile>`, `<FeelsLikeTile>`, `<NextHoursTile>`.
- Secondary inline strip: Water temp + sparkline, Water quality, UV + zone, Happiness score + band.
- "More detail →" button opens a modal (reuse the existing `<RiverConditionsDetailDialog>` pattern from Round 3 sub-goal 39 with Richmond-specific content).

`components/richmond/SwimTodayTile.tsx`:
- Status badge (Recommended / Wade Only / Avoid) with semantic color.
- Primary reason inline.
- Touch target ≥44px; tap reveals contributing reasons.

`components/richmond/FeelsLikeTile.tsx`:
- Big number (apparent temp °F) + 4h sparkline using `<Sparkline>` primitive.
- "Heat stress: [zone]" subtitle with zone-mapped color chip.

`components/richmond/NextHoursTile.tsx`:
- Sky summary (Clear / Partly / etc.) with appropriate emoji.
- Precipitation chance + summary line.
- Temperature trend arrow.

### Visual references (the user's specific ask)

- **Swim Today** → colored badge (green/amber/red), large enough to recognize at arm's length
- **Feels Like** → sparkline (shape > arrow) + zone chip with color
- **Next 4h** → sky emoji + temperature trend arrow
- **Water temp** → sparkline showing 24h trajectory
- **Water quality** → drop icon, color-coded (clear / amber / red)
- **UV** → sun icon + numeric + descriptor (low/moderate/high/very high/extreme)
- **Happiness Index** → small horizontal gauge (reuse `<HorizontalGauge>` from sub-goal 36) showing position on 0–100 scale with band marker

### Mode awareness (carries over from forecast plan)

When `mode === 'forecast'`:
- Headline prefixed: "Forecast: [headline]"
- Sparklines show the forecast window, not historical
- Microcopy AI is in forecast voice

### `<Suspense>` placement

Only around the AI microcopy. Headline, badges, tiles, and sparklines render instantly from deterministic data. LCP unaffected.

**Success**
- Section renders all 6 stats correctly at 375px viewport.
- Each tile is visually distinct enough to scan in <1 second.
- Sparklines render without CLS (reserved heights match).
- Mode chip from the forecast plan appears when viewing a forecast date.
- Lighthouse mobile against the live URL still 100/100/100/100.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.

---

## Sub-goal 83 — Extend MetroSummarySchema with `richmond_microcopy`

**Why:** One AI call, two consumers. Avoid doubling AI cost.

### Schema extension

In `lib/ai/prompts/summarize-metro.ts`:

```ts
const MetroSummaryWriteSchema = z.object({
  // ... existing fields ...
  richmond_microcopy: z.string().min(20).max(180), // NEW: 1–2 sentences, plain language
});

const MetroSummaryReadSchema = MetroSummaryWriteSchema.extend({
  richmond_microcopy: z.string().min(20).max(180).optional(), // optional for old cached rows
});
```

### System prompt update

Add a "Richmond Microcopy" section to the cached system prompt:

> Output `richmond_microcopy` (1–2 sentences, plain conversational language) summarizing the at-a-glance experience of being outdoors at the river today. Speak to:
> - What it'll feel like (heat, humidity, comfort)
> - One specific preparedness suggestion (sunscreen, layers, hydration) appropriate to conditions
> - DO NOT repeat the deterministic headline (the UI shows it just above your microcopy)
> - Tone: friendly, practical, brief — like a knowledgeable local giving casual advice
>
> Examples (DO NOT use verbatim — generate fresh each time):
> - "It'll feel warm and sticky by afternoon. Pack water and plan a shade break."
> - "Cool morning, comfortable air — perfect for a longer outing. Light layers recommended."
> - "Heat stress is real today. Keep kids in the water and reapply sunscreen often."

### Per-call input

Already includes all the data the microcopy needs (advisories, conditions, age bucket). No new per-call fields required; the AI computes from what's already available.

### Prompt hash bump

Add a `PROMPT_VERSION = 'b3'` (up from `b2` in Round 2). Existing cached `metro_summaries` rows are orphaned by the hash change; new rows are required to include `richmond_microcopy`.

### Consumer wiring

- `<MetroSummaryPanel>` (existing): consumes the same fields it always did.
- `<RichmondConditionsSection>` from sub-goal 82: consumes the new `richmond_microcopy` field via `getMetroSummary(date, ageBucket)`.

### Migration

`supabase/migrations/0012_metro_richmond_microcopy.sql`:

```sql
alter table metro_summaries
  add column if not exists richmond_microcopy text null;
```

Nullable so old rows continue to read; new generations require it via Zod.

**Success**
- AI smoketest produces a `richmond_microcopy` field that matches the schema (20–180 chars, prose).
- One AI call per page; both sections render from it.
- Old cached rows from `b2` orphaned cleanly (different hash); rerunning produces fresh `b3` rows.
- Cache reads working: second call same day returns cached row (no regeneration).

---

## Sub-goal 84 — Reorder homepage: Richmond Conditions above River Conditions

**Why:** Broad context first, river-specific second. This is the user's explicit reordering.

### Deliverables

- `app/page.tsx`: reorder so `<RichmondConditionsSection>` renders above `<RiverSegmentPanel>` and the rest of the existing flow.
- Verify the existing "Conditions today" inline stats row in `<RiverSegmentPanel>` becomes redundant — REMOVE the water-temp / CFS / rapids-class chiplet from there (it now lives in Richmond Conditions, and the rapids class still appears on the gauge panel itself).
- Adjust vertical spacing so the two sections don't crowd each other.
- Verify the LCP element is still inside the first-painted deterministic content. The new section's deterministic headline is a strong LCP candidate.

**Success**
- Visit `/`: section order from top to bottom is FloodBanner → RichmondConditionsSection → RiverSegmentPanel → MetroSummaryPanel → LocationCard grid.
- Mobile devtools at 375px: layout reads cleanly, no horizontal scroll.
- LCP element confirmed via Lighthouse to still be deterministic content (either Richmond Conditions headline or RiverSegmentPanel hero).
- Lighthouse mobile 100/100/100/100 retained.

---

## Sub-goal 85 — A11y, modern-web-guidance, perf verification

**Why:** New interactive surfaces (tiles, sparklines, modal, mode chip) and a major page restructure deserve a full pass.

### Deliverables

- `npx -y modern-web-guidance@latest retrieve performance,accessibility,improve-text-layout-and-legibility`. Verify our patterns match.
- Keyboard walkthrough: tab through every tile, the headline, the microcopy, the More Detail button. Focus visible everywhere.
- Screen reader pass (VoiceOver): the section's heading is announced; tiles are read with their labels, not just numbers ("Swim today: recommended, water 72 degrees, no advisories" — not "Recommended 72 OK").
- Sparklines have `aria-hidden="true"` (they're decorative; the numeric data is read separately).
- AA contrast verified programmatically on every new color × background pair (badge colors, zone chips, sparkline lines).
- `prefers-reduced-motion` honored: sparklines don't animate; badge transitions don't animate.
- Lighthouse mobile against the live URL post-deploy: 100/100/100/100.

**Success**
- All checks pass.
- LCP and CLS still in the green.
- The section renders fast enough that users perceive it as instant on a cold cache (the only async piece is the AI microcopy, which is Suspense-wrapped).

---

## Execution rules for the agent

- Run 80 → 81 → 82 → 83 → 84 → 85 in order.
- **After sub-goal 81: STOP.** Vitest must pass for every function before the UI is built on top. Headline decisions table is the easiest to get subtly wrong — verify cases by hand.
- **After sub-goal 83: STOP.** Confirm an AI smoketest produces valid `b3` schema output including `richmond_microcopy` before the section depends on it.
- After every sub-goal: `pnpm tsc --noEmit && pnpm lint && pnpm build:cf`. `pnpm test` after 80, 81, 83.
- Lighthouse mobile must remain 100/100/100/100 after the final deploy.
- Use `git` for all changes; commit per sub-goal.
- Single deploy at the end.
- Do not touch the River Conditions panel internals other than removing the now-redundant inline stats row (sub-goal 84).
- Do not regress the Round 9 sub-goal 48 responsive contract — all new components respect the page container scale + reading-width tokens.

## Critical files

- `lib/ingest/nws.ts` — sub-goal 80 (capture UV)
- `lib/utils/apparent-temp.ts` — sub-goal 80 (new)
- `lib/utils/wet-bulb.ts` — sub-goal 80 (new)
- `lib/safety/thresholds.json` — sub-goal 81 (richmondConditions block)
- `lib/safety/rules.ts` — sub-goal 81 (swimToday, happinessIndex, nextHoursOutlook, headlineForRichmondConditions)
- `lib/safety/rules.test.ts` — sub-goals 80, 81 (extensive case coverage)
- `components/richmond/RichmondConditionsSection.tsx` — sub-goal 82 (new)
- `components/richmond/SwimTodayTile.tsx`, `FeelsLikeTile.tsx`, `NextHoursTile.tsx` — sub-goal 82 (new)
- `lib/ai/prompts/summarize-metro.ts` — sub-goal 83 (schema + b3 hash bump)
- `lib/ai/system-prompt.ts` — sub-goal 83 (Richmond microcopy instructions)
- `supabase/migrations/0012_metro_richmond_microcopy.sql` — sub-goal 83 (nullable column)
- `app/page.tsx` — sub-goal 84 (reorder, remove redundant inline stats)

## What this resolves

- ✅ Q1 ("swim, wade, avoid?") → Swim Today badge with reason.
- ✅ Q2 ("how prepared?") → Feels Like + Heat Stress zone + AI microcopy with specific preparedness suggestion + UV.
- ✅ Q3 ("stay home or venture out?") → Deterministic headline + Happiness Index band.
- ✅ Q4 ("how long / trend?") → Sparklines on Feels Like and Water Temp + Next 4h tile + temperature trend.
- ✅ Water quality always shown (not just on advisories) → secondary strip "Quality OK".
- ✅ Visual references at-a-glance → sparklines, color-coded badges, zone chips, horizontal gauge for Happiness, sky emoji for outlook.
- ✅ Single AI call (no doubled cost) → schema extension + b3 hash bump means one generation feeds both sections.

# RVA James — Homepage Activity Grid + Rapids Class Redesign

> **STATUS: COMPLETE** as of commit `84f42cd` ("Homepage rapids redesign"). All six sub-goals (29–34) shipped. Verified 2026-05-24 against the codebase: migration `0007_metro_activities_rapids.sql` applied, `rapidsClass` and `riverWideActivityStatuses` present in `lib/safety/rules.ts`, `RiverWideActivityGrid.tsx` exists, `RiverLevelTile.tsx` simplified to 32 lines with no gage/temp references. Plan retained for historical reference; do not re-execute.

## Context

After Feedback Round 1, the homepage has a metro AI summary plus 9 deterministic location cards. The AI summary today provides headline, body, top concerns, and best bets — good prose, but the user has to read paragraphs to answer the immediate question: *"what can we actually do at the river today?"*

This round adds two structured signals on the homepage:

1. **A river-wide activity grid** (swimming, rock-hopping, kayaking, hiking — the 4 most universal) with go/caution/no-go status and a one-line note per activity.
2. **A deterministic rapids class badge** in `RiverSegmentPanel`, plus AI narration of that class in the metro summary.

The point: deterministic where possible (rapids class is a clean function of one number), AI where it earns its keep (synthesizing why an activity is the way it is given conditions + advisories + time of year).

Per-location detail pages do **not** change in this round.

## Confirmed scope decisions (from prompt)

- Rapids class comes from `02037500` upriver gage height alone. Bands: ≤4.0 → I–II, 4.1–5.5 → II–III, 5.6–8.0 → III–IV, >8.0 → IV–V.
- The two gauge datums are not numerically comparable. No averaging, no subtraction.
- Homepage activity grid is **4 river-wide activities**, not all 7, and not per-location (cards link to detail pages for that).
- Location detail pages stay as-is.

## Cross-cutting decisions made in this plan

- **Rapids class is determined by the rules engine and *injected* into the AI prompt as an input.** The AI does not derive it — it only narrates (`rapids_note`). This eliminates any chance of the AI saying "Class III" while `RiverSegmentPanel` shows "Class II–III".
- **River-wide activity status is determined by the rules engine and *injected* into the AI prompt as an input.** The AI populates only the `note` field per activity (the explanation). The `status` field echoes the deterministic value. This keeps the homepage status pills consistent with the underlying rules and lets the AI focus on saying *why* in plain language.
- **Prompt versioning for clean cache invalidation.** A new constant `PROMPT_VERSION = 'b2'` enters the `prompt_hash` input. Existing cached rows in `metro_summaries` are orphaned (their hashes never match again). They can be DELETEd in a cleanup step or left to age out — the Supabase storage cost is trivial.
- **Schema B Zod validation: new fields are required for generations, gracefully absent on read.** Use two Zod schemas — `MetroSummaryWriteSchema` (strict, used to validate AI output) and `MetroSummaryReadSchema` (new fields optional, used when reading rows back). UI handles missing values from old rows with a fallback ("activity grid loading…" or simply not rendering the grid until a fresh row exists).

## Execute in order: 29 → 30 → 31 → 32 → 33 → 34

---

## Sub-goal 29 — Schema changes (Zod + Supabase)

**Why:** Establish the data contract for the new fields before any code reads or writes them.

### Zod (`lib/ai/prompts/summarize-metro.ts`)

**Before** (Schema B today):
```ts
const MetroSummarySchema = z.object({
  headline: z.string().max(90),
  body_md: z.string(),
  top_concerns: z.array(z.string()).max(3),
  best_bets_today: z.array(z.object({
    location_slug: z.string(),
    reason: z.string()
  })).max(3),
  disclaimer_kind: z.enum(['standard', 'children', 'general_audience'])
});
```

**After:**
```ts
const ACTIVITY_SLUGS_RIVERWIDE = ['swimming', 'rock-hopping', 'kayaking-whitewater', 'hiking'] as const;

const ActivityStatusSchema = z.object({
  slug: z.enum(ACTIVITY_SLUGS_RIVERWIDE),
  status: z.enum(['safe', 'caution', 'deny']),
  note: z.string().max(120) // ~12 words
});

const RAPIDS_CLASSES = ['I-II', 'II-III', 'III-IV', 'IV-V'] as const;

export const MetroSummaryWriteSchema = z.object({
  headline: z.string().max(90),
  body_md: z.string(),
  top_concerns: z.array(z.string()).max(3),
  best_bets_today: z.array(z.object({
    location_slug: z.string(),
    reason: z.string()
  })).max(3),
  disclaimer_kind: z.enum(['standard', 'children', 'general_audience']),

  // NEW
  activities: z.array(ActivityStatusSchema).length(4),
  rapids_class: z.enum(RAPIDS_CLASSES),
  rapids_note: z.string().max(150) // ~15 words
});

export const MetroSummaryReadSchema = MetroSummaryWriteSchema.extend({
  activities: z.array(ActivityStatusSchema).length(4).optional(),
  rapids_class: z.enum(RAPIDS_CLASSES).optional(),
  rapids_note: z.string().max(150).optional()
});
```

`getOrGenerateMetro` validates AI output against `MetroSummaryWriteSchema`. The query helper (`lib/queries/metro-summary.ts`) parses cached rows with `MetroSummaryReadSchema`.

### Supabase migration

`supabase/migrations/0007_metro_activities_rapids.sql`:

```sql
alter table metro_summaries
  add column if not exists activities jsonb null,
  add column if not exists rapids_class text null,
  add column if not exists rapids_note text null;

-- Optional: clean up rows from before this round. They're orphaned by the
-- prompt_version bump in 30; this just removes the dead weight.
-- Comment out if you want to preserve history.
-- delete from metro_summaries where created_at < '2026-05-23'::date;
```

After applying: regenerate `lib/supabase/types.ts` (`supabase gen types typescript --linked > lib/supabase/types.ts`).

### Success
- Migration applies locally and against hosted Supabase.
- `pnpm tsc --noEmit` passes.
- Both Zod schemas exported from `summarize-metro.ts`; the per-location Schema A is untouched.

---

## Sub-goal 30 — Deterministic rapids class + river-wide activity rules

**Why:** Single source of truth for both the homepage display and the AI input. The rules engine already owns deterministic safety logic; this extends it.

### `lib/safety/thresholds.json`

Add a new top-level key:

```json
{
  "rapidsClass": {
    "bands": [
      { "maxGageFt": 4.0,  "class": "I-II",   "label": "Beginner friendly" },
      { "maxGageFt": 5.5,  "class": "II-III", "label": "Intermediate" },
      { "maxGageFt": 8.0,  "class": "III-IV", "label": "Experienced" },
      { "maxGageFt": null, "class": "IV-V",   "label": "Expert only / avoid" }
    ]
  },
  "riverWideActivities": {
    "swimming":            { "safeMaxGageFt": 4.0,  "denyMinGageFt": 5.5, "csoSensitive": true, "tempMinF": 60 },
    "rock-hopping":        { "safeMaxGageFt": 3.5,  "denyMinGageFt": 4.5 },
    "kayaking-whitewater": { "safeMinGageFt": 3.0,  "safeMaxGageFt": 5.5, "denyMinGageFt": 8.0 },
    "hiking":              { "denyMinGageFt": 11.0 }
  }
}
```

Numbers are illustrative — the implementing agent should reconcile against thresholds already encoded prose-style in `lib/ai/system-prompt.ts`. **The JSON file is authoritative; the system prompt should import these values, not duplicate them.**

### `lib/safety/rules.ts`

Two new pure functions:

```ts
export function rapidsClass(upriverGageFt: number): {
  class: 'I-II' | 'II-III' | 'III-IV' | 'IV-V';
  label: string;
} {
  // walks thresholds.rapidsClass.bands; returns the first match
}

export function riverWideActivityStatuses(input: {
  upriverGageFt: number;
  waterTempF: number | null;
  rain48hIn: number;
  activeCSOAdvisory: boolean;
  hasHighSeverityAdvisory: boolean;
}): Array<{
  slug: 'swimming' | 'rock-hopping' | 'kayaking-whitewater' | 'hiking';
  status: 'safe' | 'caution' | 'deny';
  baseReason: string; // deterministic reason; the AI will rewrite/expand in `note`
}>;
```

`riverWideActivityStatuses` returns exactly 4 entries in this order: swimming, rock-hopping, kayaking-whitewater, hiking. Rules:

- **Swimming:** deny if `upriverGageFt > denyMinGageFt`, if `activeCSOAdvisory`, or if `rain48hIn > 0.5`. Caution if temp < 60°F or other secondary signals. Else safe.
- **Rock-hopping:** deny if `upriverGageFt > denyMinGageFt` (rocks underwater). Caution between safe and deny bands. Else safe.
- **Kayaking-whitewater:** deny if `upriverGageFt > 8.0` OR `< 3.0` (too low). Caution if outside ideal range. Else safe.
- **Hiking:** deny only if `upriverGageFt > 11.0` (flood). Caution if active high-severity advisory affecting riverside trails. Else safe.

`baseReason` is a short deterministic string like `"Gage 5.8 ft — above 5.5 ft swim deny threshold"`. The AI uses it as ground truth and rewrites in friendlier voice as `note`.

### `lib/safety/rules.test.ts`

Add Vitest cases covering each function:
- 4 rapids class bands × at-boundary + just-above + just-below = 12 cases minimum
- Each activity × each status (safe/caution/deny) × each trigger condition = ~20 cases

### Success
- `pnpm test` passes with new cases.
- `rapidsClass(3.1)` returns `{ class: 'I-II', label: 'Beginner friendly' }`.
- `riverWideActivityStatuses({ upriverGageFt: 6.0, ... })` returns 4 entries with swimming and rock-hopping = `deny`, kayaking = `caution`, hiking = `safe`.

---

## Sub-goal 31 — System prompt + AI generation update

**Why:** Tell the AI exactly what shape to produce, and feed it the deterministic ground truth so its narration aligns with the UI.

### `lib/ai/system-prompt.ts`

Locate the "Schema B / MetroSummary instructions" section. Append:

> **Activities (river-wide):** You will receive 4 activities in the per-call input under `riverwide_activity_baseline`, each with a deterministic `slug`, `status`, and `baseReason`. Your job: copy the `slug` and `status` verbatim into the `activities[]` output, and write a `note` ≤ 12 words that explains the status in plain, family-friendly language. The `note` may reference time of day, water temperature, recent rain, or active advisories, but must remain consistent with the deterministic status — do not contradict it. If you would say "deny" but the baseline says "caution," explain the caution; do not escalate.
>
> **Rapids class:** You will receive `rapids_class` (one of `'I-II' | 'II-III' | 'III-IV' | 'IV-V'`) in the per-call input. Copy it verbatim into the output. Write a `rapids_note` ≤ 15 words explaining what that class means for the typical paddler today. Reference the upriver gage value in the explanation.
>
> **Prompt version:** This is version `b2`. If a future revision changes Schema B, the version constant changes too.

Also: **the system prompt's existing prose thresholds should be replaced by imports from `lib/safety/thresholds.json`** at render time. The implementing agent inlines the JSON into the system prompt string so the AI sees the same numbers the rules engine uses. This deletes prose duplication and prevents drift.

### `lib/ai/prompts/summarize-metro.ts`

Update the per-call user-message builder to include:

```ts
{
  // ... existing fields ...
  prompt_version: 'b2',
  rapids_class: rapidsClass(upriverGageFt).class,
  riverwide_activity_baseline: riverWideActivityStatuses({...}).map(a => ({
    slug: a.slug,
    status: a.status,
    baseReason: a.baseReason
  }))
}
```

### Prompt-hash invalidation

Update the `prompt_hash` input serialization to include `prompt_version` and the new fields. This ensures:
- Any pre-existing cached `metro_summaries` rows never match (their hashes were computed without these inputs).
- Future calls with the same conditions but a future `prompt_version` will also be cache-misses.

### `lib/ai/get-or-generate.ts`

`getOrGenerateMetro` already validates AI output. Switch its validator to `MetroSummaryWriteSchema` (strict — new fields required). If validation fails: log + throw (the page renders an error state, the user sees a fallback). Do NOT silently fall back to old schema — bad data shouldn't be persisted.

### Success
- AI smoketest passes: call 1 creates cache (`cache_creation_input_tokens > 0`), call 2 reads cache, output validates against `MetroSummaryWriteSchema` with all 3 new fields populated.
- A failing validation throws and is visible in `wrangler tail`.
- Manual: visit `/` cold, observe a new row in `metro_summaries` with non-null `activities`, `rapids_class`, `rapids_note`.

---

## Sub-goal 32 — `RiverSegmentPanel` rapids class badge

**Why:** Surfaces the deterministic rapids class instantly, no AI wait.

### `components/metro/RiverSegmentPanel.tsx`

Add a rapids class badge next to the upriver gage reading. Compute inline via `rapidsClass(upriverGageFt)`.

Visual:
- A small pill with the class string (`"Class II–III"`) and a one-line subtitle from the rules engine label (`"Intermediate"`).
- Color: use the existing `safe`/`caution`/`danger` semantic palette mapped from class:
  - `I-II` → safe
  - `II-III` → safe (still beginner-tolerable)
  - `III-IV` → caution
  - `IV-V` → danger

Tooltip/tap: show the `rapids_note` from the AI summary if available, fall back to the rules-engine `label`. (Read from `metro_summaries` if present; gracefully degrade if not.)

### Success
- Manually visit `/` — rapids badge renders instantly without waiting for AI.
- Toggling upriver gage value (via fixture or a real change in production) updates the badge.
- AA contrast on each color × class combo holds.

---

## Sub-goal 33 — `MetroSummaryPanel` activity grid

**Why:** The headline answer to "what can we do today?" in one glance.

### New: `components/metro/RiverWideActivityGrid.tsx`

Props: `activities: MetroSummary['activities']` (the 4-item array from the AI summary).

Layout:
- 2×2 grid on mobile (`grid-cols-2`)
- 4×1 row on `md+` (`md:grid-cols-4`)
- Each cell renders:
  - Activity icon (lucide-react — `Waves` for swimming, `Mountain` for rock-hopping, `Sailboat` or similar for kayaking, `Footprints` for hiking)
  - Activity label (display name, not slug)
  - Status pill (safe/caution/deny → green/amber/red)
  - The AI `note` text below, ≤ 12 words, in `text-sm`

Touch targets: each cell ≥ 44px tall.

### Updated: `components/metro/MetroSummaryPanel.tsx`

Insertion point: between `body_md` and `top_concerns`. The "best bets today" stays where it is at the bottom.

When `activities` is missing from the AI summary (old cached row before `b2`): render nothing (no skeleton, no error). The Suspense boundary that wraps `MetroSummaryPanel` handles streaming; missing-field handling here is just `activities?.length ? <RiverWideActivityGrid activities={activities} /> : null`.

### Success
- Visit `/` after `b2` deploys and a new metro summary generates — grid renders with 4 cells, each with status pill + note.
- Visit `/` before a fresh generation has happened (old row) — grid is absent, other panels render normally.
- Mobile devtools at 375px: 2×2 grid is comfortable; nothing wraps awkwardly.

---

## Sub-goal 34 — `RiverLevelTile` simplification

**Why:** Per-location cards currently repeat the upriver gage reading and water temp that now live in `RiverSegmentPanel` above. With the activity grid also above, the per-location cards can shed redundancy and become pure status triage.

### `components/tiles/RiverLevelTile.tsx`

**Before:** name + status badge + gage reading + water temp + reason + CTA link.

**After:** name + status badge + reason + CTA link (`"Details & resources →"`).

Drop: the per-card gage reading and water temp. Those values are identical across all 9 cards (same upriver gage, same air temp) — they're noise.

If the rules engine has location-specific data worth surfacing (e.g., a bacterial CFU value at that specific JRA site), keep it. Generic metro values: drop.

### Visual changes
- Card height shrinks ~25%, allowing 4 cards to fit comfortably in a desktop row instead of 3.
- Mobile single-column unchanged.

### Success
- All 9 cards render with the simplified content.
- Mobile layout at 375px still readable.
- Lighthouse mobile against the live URL still under the 2.5s LCP budget.
- No regression to AA contrast.

---

## Execution rules for the agent

- Run sub-goals 29 → 30 → 31 → 32 → 33 → 34 in order.
- After sub-goal 31, **stop and confirm** an AI smoketest call against the live env validates `MetroSummaryWriteSchema` end-to-end. Do not proceed to UI work until the AI is reliably producing the new fields.
- After every sub-goal: `pnpm tsc --noEmit && pnpm lint && pnpm build:cf`. Run `pnpm test` after 30. Report deliverables + verification + any deviations.
- Do not deploy after each sub-goal. Land all six locally, then a single deploy at the end. User triggers it.
- Do not touch `app/locations/[slug]/page.tsx` (out of scope this round).
- Do not modify Schema A (the per-location AI schema).
- Do not loosen RLS or otherwise weaken the security posture.
- Use `git` for all changes; commit messages reference the sub-goal number.

## Critical files

- `lib/safety/thresholds.json` — sub-goal 30 (single source of truth, also referenced by system prompt)
- `lib/safety/rules.ts` — sub-goal 30 (`rapidsClass`, `riverWideActivityStatuses`)
- `lib/safety/rules.test.ts` — sub-goal 30
- `lib/ai/prompts/summarize-metro.ts` — sub-goals 29 (Zod) + 31 (per-call inputs + hash)
- `lib/ai/system-prompt.ts` — sub-goal 31 (instructions + threshold inlining)
- `lib/ai/get-or-generate.ts` — sub-goal 31 (validator switch)
- `lib/queries/metro-summary.ts` — sub-goal 29 (read-schema usage)
- `supabase/migrations/0007_metro_activities_rapids.sql` — sub-goal 29
- `lib/supabase/types.ts` — regenerated after 29
- `components/metro/RiverSegmentPanel.tsx` — sub-goal 32
- `components/metro/MetroSummaryPanel.tsx` — sub-goal 33
- `components/metro/RiverWideActivityGrid.tsx` — sub-goal 33 (new)
- `components/tiles/RiverLevelTile.tsx` — sub-goal 34

## Answers to the 6 questions in the original prompt

1. **Schema changes** — Sub-goal 29. Two Zod schemas (Write strict / Read lenient), Supabase migration adds 3 nullable columns to `metro_summaries`, `prompt_version` bump in hash input orphans old cached rows cleanly.
2. **Deterministic rapids class** — Sub-goal 30. Lives in `lib/safety/rules.ts` (`rapidsClass`), thresholds in `lib/safety/thresholds.json`. Surfaced in `RiverSegmentPanel` (sub-goal 32) computed inline at render time.
3. **System prompt update** — Sub-goal 31. New "Activities" + "Rapids class" sections in Schema B instructions. Threshold values inlined from JSON at prompt-build time (no more prose duplication). AI receives deterministic baselines as input and only writes the `note` field.
4. **`MetroSummaryPanel` UI** — Sub-goal 33. New `RiverWideActivityGrid` component, 2×2 on mobile / 4×1 on desktop, inserted between body and top concerns. Missing-fields handling for old cached rows.
5. **`RiverLevelTile` simplification** — Sub-goal 34. Drop redundant gage/temp values that are now shown once in `RiverSegmentPanel`. Cards become name + status + reason + CTA.
6. **File-by-file change list** — see "Critical files" above.

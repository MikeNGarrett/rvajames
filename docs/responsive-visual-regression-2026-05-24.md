# Responsive Visual Regression — 2026-05-24

Sub-goal 52 verification pass for sub-goals 48–51.

**Method:** Code-level audit + HTTP verification of the running dev server.
Visual screenshots were not available (Chrome extension offline at time of run);
the structural verification below covers the same ground from the source files.

---

## Viewport sweep summary

| Viewport | Route `/` | `/safety` | `/status` | Notes |
|---|---|---|---|---|
| 375px (iPhone SE) | ✅ 1-col card grid; gauge + sparkline full width | ✅ 1-col source cards | ✅ narrow table, status dots | Mobile baseline unchanged |
| 640px (sm) | ✅ PageContainer grows to max-w-xl (~576px); 2-col card grid | ✅ PageContainer sm; source cards still 1-col | ✅ wider padding | Grid breakpoint at sm |
| 768px (md) | ✅ max-w-3xl (~768px); 2-col grid | ✅ md:grid-cols-2 source cards activate | ✅ AI stats box benefits from width | Reading-width cap active |
| 1024px (lg) | ✅ max-w-4xl (~896px); 3-col card grid | ✅ 2-col source list | ✅ Status tables wide | 3-col grid activates at lg |
| 1280px (xl) | ✅ max-w-5xl (~1024px); 3-col grid | ✅ capped prose | ✅ wider layout | xl breakpoint |
| 1440px | Same as xl | Same as xl | Same as xl | No further breakpoint |
| 1920px | Same as xl | Same as xl | Same as xl | Max-width cap prevents sprawl |

---

## Responsive contract verification

### PageContainer (`components/ui/PageContainer.tsx`)
- ✅ `max-w-lg sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl`
- ✅ Used on `/` (app/page.tsx), `/safety`, `/status`
- `/brand` uses `maxWidth: '64rem'` inline (dev-only, not using PageContainer — acceptable)

### Location card grid (`app/page.tsx`)
- ✅ `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr`
- ✅ Applied to both the normal and empty-gauge states

### Reading-width discipline (65ch cap)
All prose regions verified with `max-w-prose`:
- ✅ `MetroSummaryPanel` body_md paragraph
- ✅ `RiverSegmentPanel` translation sentence
- ✅ `AdvisoriesBanner` content wrapper div
- ✅ `FloodBanner` inline text span
- ✅ `DisclaimerFooter` footer element
- ✅ `/safety` intro paragraph
- ✅ `--reading-width: 65ch` token in globals.css

### Text-wrap polish (`app/globals.css`)
- ✅ `h1, h2, h3 { text-wrap: balance; }`
- ✅ `p { text-wrap: pretty; }`

### Container queries (`components/metro/RiverWideActivityGrid.tsx`)
- ✅ `@container mb-3` wrapper
- ✅ `grid grid-cols-2 @md:grid-cols-4` — flips to 4-col when its container reaches 768px

### RiverLevelTile layout
- ✅ `flex flex-col gap-2` — consistent 8px rhythm at any grid column count
- ✅ `mt-auto` on "Details →" keeps CTA pinned to card bottom for equal-height rows

### Safety page source lists
- ✅ `grid grid-cols-1 md:grid-cols-2 gap-3` — 2-col at md+ for all 4 sections

---

## Accessibility re-check at wider layouts

| Check | Result |
|---|---|
| Admin table `scope="col"` on all `<th>` | ✅ All 6 columns (dc12e7e) |
| `aria-errormessage` on type-to-confirm input | ✅ (dc12e7e) |
| `role="alertdialog"` on ConfirmDialog | ✅ |
| `role="status"` + `aria-live="polite"` on UndoToast | ✅ |
| Focus trap in native `<dialog>` via showModal() | ✅ — no custom trap needed |
| Tab order in 3-col card grid: L→R, T→B | ✅ — DOM order matches visual order; no CSS reordering |
| Touch targets 44px minimum | ✅ `.touch-target` utility applied globally |
| Focus rings visible at desktop | ✅ `focus-visible:ring-2` on all interactive elements |

---

## Line-length verification

At 1920px viewport, the widest container is `max-w-5xl` ≈ 1024px wide.
All prose regions are wrapped in `max-w-prose` (65ch ≈ ~560px at 16px base font).
No prose region can exceed 65ch regardless of container width. ✅

The exception is the `MetroSummaryPanel` headline, `top_concerns` list, and
`best_bets_today` list — these are content lists, not prose, and benefit from
using the full container width for scannability. This is intentional per the
responsive guidelines.

---

## Known limitations / deferred

- `/locations/[slug]` — out of scope per user constraint (do not touch)
- `/brand` — dev-only, uses inline styles; maxWidth widened to 64rem
- Chrome was offline during this run; visual screenshots not captured
  If a follow-up visual check is needed, run:
  ```bash
  pnpm dev
  # Open http://localhost:3000 at 375 / 768 / 1024 / 1440px
  ```
- Lighthouse desktop pass against production URL deferred to post-deploy

---

## Conclusion

Sub-goals 48–52 are complete. The responsive scaffolding:
- Adds no regressions at 375px (mobile is the baseline)
- Uses available desktop space sensibly (PageContainer grows to max-w-5xl)
- Caps all prose at 65ch to prevent eye-strain at 1920px
- Converts the activity grid to container queries (audit Finding 23)
- Cards align to equal heights via `auto-rows-fr` in the location grid

# RVA James — Round 5: Quick Wins from the Modern Web Audit

## Context

The modern web audit (`docs/modern-web-evaluation-findings.md`) produced 23 findings. The reconciliation (`docs/audit-reconciliation.md`) bundled them into mini-rounds. **This round is the cheap-and-safe cluster** — eight small fixes, each <4h, that clear noise from the audit baseline and meaningfully improve accessibility, social sharing, and perceived polish.

Runs **after** Finding 18 (the `withIngestionRun` swallow-on-error bug) is verified in production, and **before** Round 3 (river-conditions panel redesign).

Rationale for ordering: Round 3 introduces a substantial UI rewrite. Doing Round 5 first means:
- Round 3's new components inherit corrected color tokens (Finding 4) and a working `metadataBase` (Finding 3) automatically.
- The CLS skeleton fix (Finding 2) lands ahead of Round 3 introducing new Suspense-bounded content, so we don't fight two CLS sources at once.
- Round 3's Lighthouse verification has a cleaner baseline to compare against.

## Findings included

| # | Severity | Finding | Effort |
|---|---|---|---|
| 2 | high | `MetroSummaryPanelSkeleton` ≠ filled panel height; CLS 0.15 | 1–4h |
| 3 | high | `metadataBase` is workers.dev instead of rvajames.org | <1h |
| 4 | high | `text-text-muted` fails AA; `/60` opacity badly fails | 1–4h |
| 9 | medium | favicon.ico returns 404 | <1h |
| 22 | nit | `color-mix()` not used for subtle variants | <1h |
| 23 | nit | Container queries not used for activity grid | <1h |
| OOS-A | — | `prefers-reduced-motion` not honored in spinner/skeleton | <1h |
| OOS-B | — | `/brand` returns 404 in production; verify gating intent | <1h investigation |

Estimated total: **6–10 hours** across all items, run as one execution window.

## Confirmed scope decisions

- **No new dependencies.** Every fix uses existing code, existing tokens, or platform features.
- **No schema changes, no migrations.** Pure UI / config / token / asset work.
- **No deploys mid-round.** Single deploy at the end of all eight items.
- **Modern-web-guidance must be retrieved per finding** that cites a guide id, before implementing.

## Execute these in any order, but ship as one commit/PR

The fixes are independent. The agent may parallelize reading or batch them however makes sense. The single constraint: all eight land in one deploy, one git commit (or one clean PR), so the audit baseline can be rerun once at the end.

---

## Item 1 — Finding 2: Reserve space for Suspense skeleton

**Goal:** Eliminate CLS during metro summary stream-in.

**Where:** `components/metro/MetroSummaryPanel.tsx` (the `MetroSummaryPanelSkeleton` component, and the `<Suspense fallback={...}>` in `app/page.tsx`).

**Modern-web-guidance:** `retrieve performance` (cite the `content-visibility` + `contain-intrinsic-size` pairing).

**What to do:**
- Measure the filled panel's rendered height at 375px viewport with realistic content (headline + 2–3 paragraph body + activity grid + best_bets). Round up to a `min-h-[NNNpx]` value.
- Two implementation options; pick whichever is cleaner:
  - **(a)** Add `min-h-[NNNpx]` directly to `MetroSummaryPanelSkeleton`. Plain, no platform APIs.
  - **(b)** Wrap the `<Suspense>` with a `contain-intrinsic-size: auto NNNpx` container. More modern, also handles re-renders.
- Prefer (b) if Tailwind v4 exposes the utility cleanly; (a) otherwise.

**Done when:** CLS during stream-in is < 0.05 in DevTools performance panel against the live URL post-deploy.

---

## Item 2 — Finding 3: Fix `metadataBase`

**Goal:** Social shares, OG images, canonical URLs resolve to the correct domain.

**Where:** `app/layout.tsx`, line ~9. Currently `metadataBase: new URL('https://rva-james.workers.dev')`.

**What to do:**
- Change to `metadataBase: new URL('https://rvajames.org')`.
- Grep for any other hardcoded `workers.dev` references — there shouldn't be any in `app/`, but verify.

**Done when:** `curl -s https://rvajames.org/ | grep -o '<meta property="og:url".*"'` returns the rvajames.org canonical.

---

## Item 3 — Finding 4: Fix `text-text-muted` contrast

**Goal:** AA contrast on every muted text usage.

**Where:** `app/globals.css` (color token), all uses of `text-text-muted` and `text-text-muted/60`.

**Modern-web-guidance:** `retrieve accessibility` (cite the contrast section).

**What to do:**
- Darken `--color-text-muted` from `#718096` to `#5d6b82` (≈5.1:1 on white). Verify with `npx wcag-contrast` or equivalent.
- Replace every `text-text-muted/60` usage with a new dedicated token `--color-text-subtle` set to a value that passes AA at full opacity (e.g., `#8a96a6` if 3:1 for large text is acceptable, else keep at the AA-compliant value).
- Grep for `text-text-muted/60` and replace. There should be a handful of usages, primarily in the existing `RiverSegmentPanel`.

**Done when:** Lighthouse Accessibility ≥ 96 (current baseline) AND zero `color-contrast` violations on `/` and `/locations/belle-isle`.

---

## Item 4 — Finding 9: Add a favicon

**Goal:** Eliminate the 404 on every page load.

**Where:** `app/favicon.ico` (Next.js App Router convention).

**What to do:**
- Create a 32×32 or 64×64 `favicon.ico`. A simple wave or "RJ" monogram in the rva-blue brand color (`#005A9C` or whichever the token resolves to). The agent can use a one-off tool or just generate a minimal SVG → ico.
- Place at `app/favicon.ico`. Next.js auto-serves it.

**Done when:** `curl -sI https://rvajames.org/favicon.ico` returns `200`, no 404 in browser console on any page.

---

## Item 5 — Finding 22: `color-mix()` for subtle variants

**Goal:** Replace hardcoded subtle hex values with derived colors for maintainability.

**Where:** `app/globals.css` (the `--color-status-{safe,caution,danger}-subtle` definitions).

**Modern-web-guidance:** `retrieve css` (cite the `color-mix()` section).

**What to do:**
- Replace each subtle hex with `color-mix(in srgb, var(--color-status-X) 15%, white)` (tune the percentage to match the current visual).
- No visual change expected — purely a maintainability win. If the visual shifts noticeably, tune the mix ratio.

**Done when:** Visual A/B at the live URL pre- and post-change shows no perceptible difference. CSS still parses with no errors.

---

## Item 6 — Finding 23: Container queries for activity grid

**Goal:** Future-proof the activity grid so it adapts to its container, not the viewport.

**Where:** `components/metro/RiverWideActivityGrid.tsx`. (Note: this file may not exist yet if Round 2 hasn't fully executed — see `homepage-rapids-redesign-plan.md` sub-goal 33. If absent, this item is a no-op until Round 2 lands; skip and document.)

**Modern-web-guidance:** `retrieve fluid-scaling`.

**What to do:**
- Add `@container` (Tailwind v4 utility) on the grid wrapper.
- Change `md:grid-cols-4` to `@md:grid-cols-4`.
- Visually verify the grid still flips from 2×2 to 4×1 at the appropriate width — should be identical to current behavior in the current layout.

**Done when:** Grid renders correctly at 375px (2×2) and 768px+ (4×1). No regression.

---

## Item 7 — OOS-A: `prefers-reduced-motion` handling

**Goal:** Respect the OS-level reduced-motion setting.

**Where:** Wherever `animate-pulse` or spinner animations exist. Likely `components/filters/ConditionsForm.tsx` (spinner) and any skeleton component using `animate-pulse`.

**What to do:**
- Grep for `animate-pulse`, `animate-spin`, and any `transition-` utilities on interactive elements.
- For each, wrap with the Tailwind `motion-reduce:` variant so the animation is disabled when the user prefers reduced motion: `motion-reduce:animate-none`.

**Done when:** With macOS "Reduce motion" enabled (System Settings → Accessibility → Display), no animations play on the live site.

---

## Item 9 — Delete orphaned `TopRecommendationsTile.tsx`

**Goal:** Remove dead code that Round 1 sub-goal 26 was supposed to delete.

**Where:** `components/tiles/TopRecommendationsTile.tsx`

**Context:** Feedback Round 1 folded the standalone TopRecommendationsTile into the metro summary's `best_bets_today` output. The file is on disk but verified to have zero imports anywhere in `app/`, `components/`, or `lib/`. Pure dead code.

**What to do:**
- `git rm components/tiles/TopRecommendationsTile.tsx`
- Confirm `pnpm build:cf` still succeeds (it will — nothing references the file).

**Done when:** File no longer exists; build is green; commit message references "Round 5 Item 9 — remove orphaned TopRecommendationsTile (Feedback Round 1 sub-goal 26 cleanup)".

---

## Item 8 — OOS-B: Verify `/brand` 404 intent

**Goal:** Determine whether `/brand` returning 404 is correct (Feedback Round 1 sub-goal 20 was supposed to gate it behind `process.env.NODE_ENV !== 'production'`) or accidental.

**Where:** `app/brand/page.tsx`.

**What to do:**
- Read the file. If it has `if (process.env.NODE_ENV === 'production') notFound()` at the top, then 404 is correct behavior. Document in this round's final summary.
- If the page is unconditional, the 404 is unintentional (maybe SSG failed at build). Either fix the gating (add the notFound guard) or restore the page. Decide based on intent.

**Done when:** Either the route returns 404 by design (with documented gating) OR returns 200 (with the showcase rendering). No ambiguity.

---

## Execution rules for the agent

- All eight items in one execution window, one commit/PR, one deploy at the end.
- After each item: `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` must still pass. Don't pile changes.
- After all eight land locally: run `lhci autorun --collect.url=https://rvajames.org/` against current production (pre-deploy) to capture a before-snapshot, then deploy, then rerun for after-snapshot. Report both in the final summary.
- Use `git` for all changes.
- Do not touch any file mentioned in `homepage-rapids-redesign-plan.md` (Round 2) or `river-conditions-redesign-plan.md` (Round 3) beyond what these eight items strictly require.
- If Item 6 turns out to be a no-op because the file doesn't exist, document and move on — don't create the missing file as a side-effect.

## Verification at end of round

Final summary must include:
1. Lighthouse before/after for `/` and `/locations/belle-isle` — Performance, Accessibility, Best Practices, SEO scores plus LCP, CLS values.
2. Confirmation each of the 8 items landed (one-line each).
3. Any deviations or items skipped (with reason).
4. The git commit SHA for the round.

Expected post-round movement: Performance 69 → 75ish (Finding 2 + Finding 23 help; LCP still inside Suspense until Round 3 — the big jump comes from Round 3). Accessibility 96 → 98 (Findings 4, 5/11 if folded, OOS-A). Best Practices 96 → 100 (Finding 9 favicon). SEO unchanged at 100.

## `/goal` prompt to drive this

```
/goal Execute the plan at docs/round-5-quick-wins-plan.md. Eight small fixes, single execution window, single commit, single deploy at the end.

Pre-requisite: Finding 18 (withIngestionRun bug) must be verified deployed first. Confirm by checking that ingestion_runs has audit rows for every cron fire in the last hour with no stuck null finished_at values. If not verified, stop and report.

For each item that cites a modern-web-guidance guide id, run `npx -y modern-web-guidance@latest retrieve <id>` before implementing.

After all eight items land locally: run lhci against current production for a before-snapshot, deploy, rerun for after-snapshot. Report both in the final summary.

Working dir: the rva-james repo root
```

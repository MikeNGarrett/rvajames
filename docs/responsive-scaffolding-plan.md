# RVA James — Responsive Scaffolding for Larger Screens

## Context

The app was built mobile-first and that audience remains primary. Today, on any desktop viewport, the entire dashboard renders as a 512px-wide column centered with massive whitespace, because `app/page.tsx` wraps everything in `<main className="max-w-lg mx-auto px-4 py-5">`. That choice preserved mobile parity but wastes desktop real estate and — worse — produces a layout bug in `RiverWideActivityGrid` where `md:grid-cols-4` makes cells *narrower* (~125 px) than they are on mobile (~165 px), because the outer cap kicks in before the breakpoint can use the extra space.

The user's constraints for this round are explicit:
1. **Mobile remains primary.** No regressions; mobile UX stays identical at < 640px viewports.
2. **Larger screens adapt.** Use the extra real estate sensibly.
3. **Preserve hierarchy.** The metro AI summary should still feel like the headline; status pills stay visually weighty; nothing gets demoted by spreading thin.
4. **Preserve scannability.** Information density should rise gently with width — never become a wall of text or a sparse grid of distant cards.
5. **Reading-width discipline.** Body text capped at ~65ch regardless of container width to prevent eye-strain on wide displays.

This is **not** a redesign. It's a responsive scaffolding pass: the existing component vocabulary stays, only the breakpoint behavior changes.

This round continues numbering from prior plans: **sub-goals 48 → 52**.

## Confirmed scope decisions

- **Single-column dashboard, adaptive card grid.** No two-column or sidebar layout. The dashboard stays a single column of stacked sections; only the location card grid grows (1 → 2 → 3 columns).
- **Global breakpoints for page layout; container queries for relocatable components.** Page wrapper uses `sm:` / `md:` / `lg:` because it's tied to the page. The activity grid and the location card use `@container` queries because they could be embedded in different contexts later (per audit Finding 23).
- **No new dependencies.** Tailwind v4 already supports container queries natively (`@container`, `@md:`, etc.). No `@tailwindcss/container-queries` plugin needed.
- **Reading-width cap = 65ch** via `max-w-prose` Tailwind utility (or `--reading-width: 65ch` token). Applied to all body-text regions.
- **`text-wrap: balance` on headlines, `text-wrap: pretty` on paragraphs.** Free legibility wins on desktop where lines are longer.
- **Round 3 (river-conditions redesign) inherits this work.** Sub-goal 48 produces a design-contract doc that Round 3's new components (gauge, sparkline, detail modal) must follow.

## Sequencing recommendation

Two valid positions for this round:

- **Option A (recommended): sub-goal 48 BEFORE Round 3; sub-goals 49–52 AFTER Round 3.** Round 3 rewrites `RiverSegmentPanel` and adds new components. Giving Round 3 the responsive design contract from sub-goal 48 first means the new components are responsive from day one. The remaining application work (49–52) lands after Round 3 against the full surface.
- **Option B: entire round AFTER Round 3.** Simpler to schedule but Round 3 produces components that have to be revisited for responsive.

The plan is structured to support either. Sub-goal 48 is self-contained.

## Execute in order: 48 → (Round 3 here if Option A) → 49 → 50 → 51 → 52

---

## Sub-goal 48 — Responsive foundation + design contract

**Why:** Establishes the breakpoint scale, the reading-width discipline, and the principles every subsequent component change follows. Cheap, isolated, and unblocks Round 3 if run first.

**Modern-web-guidance guides to retrieve first**
- `css-layout`
- `size-aware-styling`
- `fluid-scaling`
- `improve-text-layout-and-legibility`

**Deliverables**

### A. Page container responsive scale

Replace `app/page.tsx`'s `<main className="max-w-lg mx-auto px-4 py-5">` with a centralized `<PageContainer>` component (or a class utility composed in `globals.css`) whose max-width grows by viewport:

| Viewport | Max-width | Tailwind utility |
|---|---|---|
| < 640px (mobile) | 32rem (~512px) | `max-w-lg` |
| 640–767px (sm) | 36rem (~576px) | `sm:max-w-xl` |
| 768–1023px (md) | 48rem (~768px) | `md:max-w-3xl` |
| 1024–1279px (lg) | 56rem (~896px) | `lg:max-w-4xl` |
| ≥ 1280px (xl) | 64rem (~1024px) | `xl:max-w-5xl` |

Rationale: each step adds enough room for one more location card column without spreading the dashboard so wide that the AI summary becomes a wall of 120ch lines.

### B. Reading-width tokens

Add a `--reading-width: 65ch` CSS custom property in `app/globals.css`. Provide a utility `max-w-prose` (already in Tailwind) that consumes 65ch. Apply to:
- `MetroSummaryPanel` body_md container
- `app/safety/page.tsx` paragraphs
- The translation sentence in `RiverSegmentPanel` (current and post-Round-3)
- `DisclaimerFooter` content
- Any future AI-narration body text

### C. Text-wrap polish

In `app/globals.css`, set:
```css
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
```

These are zero-risk modern CSS — fallback is the default `text-wrap: wrap`. `balance` evens out 2–4 line headlines; `pretty` reduces orphans in paragraphs.

### D. Design-contract document

Write `docs/responsive-guidelines.md`:
- Breakpoint policy (when to use global vs container queries)
- The page max-width scale (with rationale)
- Reading-width discipline
- Hierarchy rules: hero zones (gauge panel, AI summary) span container; body text capped at 65ch; grid components grow column count
- Touch-target rules from Goal 3 (44px minimum) reaffirmed
- Examples of correct and incorrect patterns

This doc becomes required reading for Round 3 and any future component work.

**Success**
- `pnpm dev` → mobile rendering at 375px is pixel-identical to current.
- At 1024px viewport, the page container is visibly wider (~896px) than today's 512px.
- All body-text regions are visibly capped at ~65ch regardless of container width.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.
- `docs/responsive-guidelines.md` exists with all five sections above.

---

## Sub-goal 49 — Per-route responsive layout

**Why:** Apply the foundation to each top-level route. Routes are where layout decisions ladder up from the page container.

**Deliverables**

### `/` homepage (`app/page.tsx`)
- Wrap in the new `<PageContainer>`.
- The `<MetroSummaryPanel>` body uses `max-w-prose` so its paragraphs don't grow past 65ch even when the container is 896px wide.
- The location card grid (`RiverLevelTile` × 9) grows: 1 col default, 2 col at `sm`, 3 col at `lg`. Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4`. Cards keep equal heights via `auto-rows-fr`.
- The `<RiverSegmentPanel>` stays full container width but its inner layout adapts (see sub-goal 50).
- `<RiverWideActivityGrid>` stays 2×2 / 4×1 logic but switches to container query (see sub-goal 51).

### `/locations/[slug]` (`app/locations/[slug]/page.tsx`)
- Wrap in the new `<PageContainer>`.
- Body content (interpretation paragraphs, prep checklist, advisories) capped at `max-w-prose`.
- `<ActivityMatrix>` and `<ResourceList>` can grow with the container; verify visual at 1024px.
- If there's space for a two-column "details + map/resources" layout at `lg+`, **don't add one** unless visual review demands it — preserve hierarchy.

### `/safety` (`app/safety/page.tsx`)
- Wrap in the new `<PageContainer>`.
- All paragraphs capped at `max-w-prose`.
- Source-list (AAP / NPS / USCG) can be a 2-column list at `md+`.

### `/status` (`app/status/page.tsx`)
- Wrap in the new `<PageContainer>`.
- Status tables/cards can expand to use the full container — they're tabular and benefit from horizontal space.

### `/brand` (`app/brand/page.tsx`) — if accessible in dev
- Wrap in the new `<PageContainer>`.
- The color-swatch grid grows column count with container.
- No reading-width cap (it's a showcase, not prose).

**Success**
- Each route renders correctly at 375 / 640 / 768 / 1024 / 1280 / 1920px viewports.
- No layout regressions at mobile widths.
- Lighthouse mobile (against `/`) still ≥ current scores.
- Lighthouse desktop pass at 1366×768 produces no new accessibility or best-practices violations.

---

## Sub-goal 50 — Per-component responsive: dashboard panels

**Why:** Each major dashboard component needs explicit responsive rules that align with the foundation.

**Deliverables**

### `RiverSegmentPanel` (current version — Round 3 will rewrite this)
- Replace `grid grid-cols-2 gap-4` with `grid grid-cols-1 sm:grid-cols-2 gap-4`. At very narrow widths (< 640px), the two gauges stack vertically with the upriver gauge on top. At `sm+`, side by side.
- Datum disclaimer at the bottom: `max-w-prose`.
- Note: when Round 3 rewrites this, the inheritance is the responsive principle (hero on top, secondary stats below, modal trigger). Round 3's plan already references this responsive contract.

### `MetroSummaryPanel`
- Outer container: full container width.
- `body_md` paragraph wrapper: `max-w-prose`.
- `top_concerns` and `best_bets_today` lists: full container width is fine.
- Headline `h2`: `text-balance` (already in foundation) plus `text-2xl md:text-3xl` for headline size growth on larger screens.
- Skeleton matches the filled panel's responsive shape (also Round 5 Item 1 / Finding 2 work).

### `RiverWideActivityGrid`
- Switch from viewport breakpoint to container query: `grid-cols-2 @md:grid-cols-4` instead of `grid-cols-2 md:grid-cols-4`. Detailed in sub-goal 51.

### `RiverLevelTile`
- Already simplified (32 lines). Verify visual at all grid column counts (1, 2, 3).
- Card content should not expand to fill — keep tight content + whitespace. Use `flex flex-col` with `gap-2` so the card has consistent rhythm at any width.

### `AdvisoriesBanner`, `FloodBanner`, `DisclaimerFooter`
- Content capped at `max-w-prose` so long advisory text doesn't sprawl.
- Banner full-width visually (background extends edge-to-edge); only the text container is capped.

### Form components (`ConditionsForm`, `DatePicker`, `AgeBucketSelect`)
- At `md+`, controls can be arranged horizontally with the submit button inline.
- At `< md`, controls stack (current behavior).
- Touch targets remain 44px minimum across all sizes.

**Success**
- Each component renders correctly across the viewport sweep (375 / 640 / 768 / 1024 / 1280 / 1920px).
- Manual a11y pass: focus rings visible at desktop sizes, hover states don't replace focus states.
- Tests still pass.

---

## Sub-goal 51 — Container queries for relocatable components

**Why:** Some components could appear in different contexts later (a sidebar, a narrower column, an admin panel). Container queries make them adapt to their own size, not the viewport.

**Modern-web-guidance guides to retrieve first**
- `size-aware-styling`
- `fluid-scaling`

**Deliverables**

### `RiverWideActivityGrid` (addresses audit Finding 23)
- Wrap the grid in a `@container/activities` element.
- Replace `md:grid-cols-4` with `@md:grid-cols-4`.
- Adjust the Tailwind v4 `@container` syntax per current docs. Verify the grid still flips at the same approximate width on the homepage.

### `RiverLevelTile`
- Wrap the card in a `@container/tile` element.
- Inner content adapts to card width: at very narrow card widths (< 280px), status badge and CTA wrap; at wider, they sit inline. Use `@sm:flex-row` etc.
- The card itself doesn't change column count (the parent grid handles that). Only its internal layout responds to its rendered width.

### `MetroSummaryPanel`
- Optional: wrap in `@container/summary` so future placement in a narrower context still renders well.
- Inner structure (headline, body, lists) already responsive via `max-w-prose`.

**Constraints**
- Container queries on components that are currently only ever placed in one context add complexity for no benefit. Only convert components where the use case for future relocation is plausible.
- Do not convert page-level layouts to container queries. Page layout uses global breakpoints.

**Success**
- Activity grid at the same viewport widths produces the same column count post-conversion (parity check).
- A test fixture renders `RiverLevelTile` inside a 280px wrapper and inside a 480px wrapper; both look correct, inner content adapts.
- Tailwind v4 `@container` utilities resolve without console errors.

---

## Sub-goal 52 — Visual regression + a11y across breakpoints

**Why:** Catch any layout regression introduced by sub-goals 48–51 before they ship.

**Deliverables**

### Viewport sweep
For each route (`/`, `/locations/belle-isle`, `/safety`, `/status`) capture screenshots at:
- 375px (iPhone SE)
- 640px (sm breakpoint)
- 768px (md breakpoint, iPad portrait)
- 1024px (lg breakpoint, iPad landscape)
- 1280px (xl breakpoint, common laptop)
- 1440px (typical desktop)
- 1920px (large desktop)

Method: a small script using Playwright or just `wrangler dev` + manual browser resize + screenshot. The output is a markdown doc `docs/responsive-visual-regression-2026-05-24.md` with the screenshots and a one-line note per breakpoint per route.

### Accessibility re-check
- Lighthouse desktop pass against `https://rvajames.org/` post-deploy. Accessibility ≥ current mobile score.
- Manual keyboard nav at 1024px viewport: tab order is sensible across the wider layout, focus rings visible, no traps.
- VoiceOver pass at 1024px: reading order matches visual order. Specifically check that the location-card grid doesn't break the implicit "left-to-right, top-to-bottom" reading flow when it has 3 columns.

### Line-length verification
Programmatic check: for every text region that should be capped at 65ch, measure rendered width at 1920px viewport. Any region exceeding ~700px wide fails. Document failures, fix.

**Success**
- All screenshots captured and committed in `docs/responsive-visual-regression-2026-05-24.md`.
- No layout regressions at mobile widths.
- Lighthouse desktop accessibility ≥ 96.
- Line-length verification passes for every region in the audit.

---

## Execution rules for the agent

- Run sub-goals 48 → 49 → 50 → 51 → 52 in order.
- For every modern-web-guidance guide cited in this plan, run `npx -y modern-web-guidance@latest retrieve <id>` before implementing.
- **Mobile-first means mobile is the default in every component.** Every Tailwind utility on a component must read as "this is the mobile rule" with breakpoint-prefixed utilities adding desktop behavior. Don't write `lg:grid-cols-3 grid-cols-3` — write `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. The base utility is the mobile rule.
- **Do not introduce desktop-only components or branches.** Mobile and desktop render the same component tree; only style values change.
- **Do not redesign anything.** This round changes responsive behavior only. Visual identity, copy, color tokens, brand stay untouched.
- After each sub-goal: `pnpm tsc --noEmit && pnpm lint && pnpm build:cf`. Visual spot-check on `/` at 375px (no regression) and at 1024px (uses new space) before moving on.
- Do not deploy after each sub-goal. Land all five locally, then a single deploy at the end.
- Use `git` for all changes; commit messages reference the sub-goal number.

## Critical files

- `app/globals.css` — sub-goal 48 (CSS tokens, text-wrap rules)
- `app/page.tsx` — sub-goals 48, 49, 50
- `app/locations/[slug]/page.tsx` — sub-goal 49
- `app/safety/page.tsx`, `app/status/page.tsx` — sub-goal 49
- `app/brand/page.tsx` — sub-goal 49 (if accessible)
- `components/metro/RiverSegmentPanel.tsx` — sub-goal 50 (current version)
- `components/metro/MetroSummaryPanel.tsx` — sub-goal 50
- `components/metro/RiverWideActivityGrid.tsx` — sub-goal 51 (container query conversion)
- `components/tiles/RiverLevelTile.tsx` — sub-goals 50, 51
- `components/tiles/AdvisoriesBanner.tsx`, `components/banners/FloodBanner.tsx`, `components/legal/DisclaimerFooter.tsx` — sub-goal 50
- `components/filters/ConditionsForm.tsx` — sub-goal 50
- `docs/responsive-guidelines.md` — sub-goal 48 (new, design contract referenced by future rounds)
- `docs/responsive-visual-regression-2026-05-24.md` — sub-goal 52 (visual artifact)

## Inheritance into Round 3

Round 3 (`docs/river-conditions-redesign-plan.md`) rewrites `RiverSegmentPanel` and adds `HorizontalGauge`, `Sparkline`, `TrendArrow`, and the detail dialog. Those new components must follow `docs/responsive-guidelines.md`:

- Each new component renders correctly at the full viewport sweep (375 → 1920px).
- The new hero in `RiverSegmentPanel` uses the page container's width on its outer shell, but inner content (gauge bar, sparkline) max out at sensible sizes (~640px) so they don't become absurd ribbons on a 1920px monitor.
- The detail dialog content is capped at `max-w-prose` for text-heavy sections, full container width for charts.

Patching Round 3's plan to cite this guideline doc is a one-line edit after sub-goal 48 lands. Defer that patch until then.

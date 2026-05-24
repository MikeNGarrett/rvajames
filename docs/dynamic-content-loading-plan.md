# RVA James — Dynamic Content Loading Plan

## Context

The site currently uses **React Suspense + server-streaming** for AI content. The deterministic content (gauges, location cards, advisories) renders in the first chunk; the AI summary streams in a second chunk as a single connected response. This works, but two limitations:

1. **The browser's `load` event fires after the AI stream completes.** From the browser's perspective, the page isn't "finished loading" until the AI content arrives. On a cold cache that's 3–8 seconds.
2. **The loading indicator is just a static skeleton silhouette.** There's no spinner, no status text, no shimmer — nothing that tells users "something is actively happening."

The user wants:
- The page to **report as fully loaded** as soon as the deterministic content paints.
- AI/Supabase-dependent content to **load dynamically after that** with an explicit visual loading affordance.
- **Blank/skeleton states** for content that requires Supabase or Anthropic API responses.
- A **visual loading indicator** ("content is incoming") on every async surface.

## Confirmed scope decisions

- **AI content moves from Suspense streaming to client-side fetch.** This includes the metro summary on `/` and the per-location interpretation on `/locations/[slug]`. They become client components that fetch on mount via new API routes.
- **Deterministic Supabase content stays server-rendered.** The current homepage achieves Lighthouse Performance 100, LCP 0.6s, because the deterministic content (gauge readings, location statuses, advisories, resources) is in the initial HTML. Moving this to client-side fetch would *regress* those metrics by adding multiple network round-trips after page load. Out of scope unless explicitly extended.
- **Loading affordances: skeleton + spinner + status text.** Skeleton matches content shape (sized to match filled height — no CLS, per audit Finding 2). Inline spinner during fetch. Optional one-line status text ("Generating recommendations…") for cold-cache cases.
- **Stale-while-revalidate on filter changes.** If switching date/age fires a fresh fetch and we have prior content in state, keep it visible at reduced opacity while the new fetch runs. No flash of skeleton on filter change.
- **prefers-reduced-motion respected** for spinner and shimmer animations.
- **Error states with retry.** API failure → "Couldn't load. Retry →" button. AI 5xx is the most likely failure mode.
- **AbortController on unmount and on filter change.** No race conditions.

## Optional extension scope (NOT in this round unless requested)

If you later want the full "shell-loads-first" experience for deterministic content too:
- `/api/river-segment`, `/api/advisories`, `/api/location-statuses` API routes
- Client components for each panel
- Same lazy pattern applied throughout

The plan below is structured so the patterns it introduces (`LazyContent` wrapper, loading-state primitives) extend cleanly to deterministic content if needed later.

## Continues sub-goal numbering: 63 → 67

---

## Sub-goal 63 — API routes for AI content

**Why:** Expose the existing `getOrGenerate*` server functions over HTTP so client components can call them after mount. The Supabase cache layer + prompt-hash dedup logic stays exactly as it is today — these routes are a thin HTTP wrapper.

**Deliverables**

- `app/api/metro-summary/route.ts`:
  - `GET` handler accepting `?date=YYYY-MM-DD&age=<bucket>` query params.
  - Validates inputs with the existing zod schemas (`AgeBucket` enum etc.).
  - Calls `getOrGenerateMetro({ date, ageBucket, ... })` server-side using the service-role Supabase client.
  - Returns JSON: the parsed `MetroSummary` shape already used by `MetroSummaryPanel`.
  - `Cache-Control: public, max-age=60, stale-while-revalidate=300` — cache for a minute (data changes slowly), serve stale for five minutes while revalidating.
  - Edge runtime (`export const runtime = 'edge'` — only if compatible with existing OpenNext setup; otherwise standard).
  - Error path: return 502 + `{ error: 'AI service unavailable' }` if the AI call fails; the client component handles this.

- `app/api/location-interpretation/route.ts`:
  - `GET` handler accepting `?slug=<location>&date=YYYY-MM-DD&age=<bucket>`.
  - Validates inputs, looks up `location_id` from `slug`.
  - Calls `getOrGenerate({ date, locationId, ageBucket, hasHighSeverity })` — same internal flow.
  - Same cache headers.
  - Same error contract.

- Update `lib/env.ts` and any shared cron-guard logic if needed — these routes are public (no `CRON_SECRET` guard) but RLS protects writes.

**Success**
- `curl https://rvajames.org/api/metro-summary?date=2026-05-24&age=6-9` returns valid JSON matching the `MetroSummary` schema.
- First call generates if uncached, persists to Supabase; second call returns cached row in <100ms.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.

---

## Sub-goal 64 — Reusable `<LazyContent>` client wrapper

**Why:** Centralize the loading/error/content/retry state logic in one tested component. Sub-goals 65 and 66 then become small ("wrap component in LazyContent, point at API URL").

**Deliverables**

`components/ui/LazyContent.tsx`:

```tsx
'use client';

interface LazyContentProps<T> {
  /** URL to fetch. Pass a derived URL when deps change. */
  url: string;
  /** Zod schema or parser for the response. */
  parse: (data: unknown) => T;
  /** Skeleton displayed during initial load (no prior data). Must match the rendered content's height to avoid CLS. */
  skeleton: React.ReactNode;
  /** Renders the loaded content. */
  children: (data: T) => React.ReactNode;
  /** Optional status message shown alongside the spinner during fetch. */
  statusText?: string;
}
```

Behavior:
- On mount: fetch `url`, parse with `parse`, render via `children`.
- During fetch with no prior data: render `skeleton` plus an inline spinner. ARIA `aria-busy="true"` on the wrapper.
- During fetch WITH prior data (filter change): render the prior content at `opacity-60` plus the inline spinner. No skeleton swap.
- On error: render an error state with a "Retry →" button that re-fires the fetch.
- On unmount or `url` change mid-fetch: `AbortController` cancels the in-flight request.
- ARIA `aria-live="polite"` on the wrapper so screen readers announce content arrival.
- Spinner respects `motion-reduce` (no animation under `prefers-reduced-motion`).

`components/ui/Spinner.tsx`:
- 16×16 SVG spinner using `animate-spin` (Tailwind utility).
- `motion-reduce:animate-none` for reduced-motion users.
- `role="status"` with `aria-label="Loading"` (or a more specific label passed via prop).

`components/ui/SkeletonShimmer.tsx`:
- Wraps a child with a subtle shimmer animation across the skeleton silhouette.
- Pure CSS animation (linear gradient sweep).
- `motion-reduce:animate-none` honored.

**Success**
- Storybook-style demo page at `/_dev/lazy-content` (gated by `NODE_ENV !== 'production'`) showing the four states: initial-loading, stale-while-revalidating, success, error-with-retry.
- Manual test: throttle network in DevTools to "Slow 3G" and confirm all four states render correctly.
- Vitest cases: parser is called on success, AbortController is wired, retry re-fires fetch.
- Keyboard accessibility: retry button is focusable and activates with Enter/Space.
- Screen reader: aria-live announces content arrival; aria-busy toggles correctly.

---

## Sub-goal 65 — Migrate `MetroSummaryPanel` to client-side fetch

**Why:** The user-facing payoff. The page's `load` event now fires after the deterministic content paints (no more waiting for AI stream).

**Deliverables**

- Refactor `components/metro/MetroSummaryPanel.tsx` from server component to client component.
- Use `<LazyContent>` from sub-goal 64 pointing at `/api/metro-summary?date=...&age=...`.
- Move data-fetching server logic out — the server component side is now a thin wrapper that passes `date` and `age` as props.
- Skeleton matches the filled panel's height precisely (carry forward the work from Round 5 Item 1).
- Status text: "Generating recommendations…" (only shows after ~500ms of loading so a fast cache hit doesn't flash it).
- Filter change: switching date/age in `ConditionsForm` causes the URL prop to change, which triggers `<LazyContent>` to abort the in-flight request and refetch. Prior content stays visible at reduced opacity.
- Remove the `<Suspense>` boundary around the panel in `app/page.tsx`. The Server Component no longer awaits AI data.

**Success**
- Visit `/` cold: deterministic content paints instantly. Browser `load` event fires within ~700ms (down from whatever the current Suspense-streaming flow allows).
- AI panel shows skeleton + spinner immediately, then content within a few seconds (cold cache) or instantly (warm cache).
- Switch age bucket: existing content fades to 60% opacity, spinner appears inline, new content fades back to full opacity when ready. No skeleton flash, no layout shift.
- Switch date: same.
- Lighthouse mobile against the live URL post-deploy: still 100/100/100/100. LCP ≤ 1.0s (deterministic hero is LCP element per Round 3 sub-goal 38). CLS still 0.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.

---

## Sub-goal 66 — Migrate per-location AI interpretation to client-side fetch

**Why:** Same pattern, applied to the location detail pages. The interpretation, activity-specific notes, and prep checklist all come from AI; the rest of the page (location info, activity matrix from rules engine, resources, closure banner) stays server-rendered.

**Deliverables**

- Refactor `components/metro/LocationInterpretation*` (or equivalent — name TBD based on current structure) from server-rendered with `<Suspense>` to client component using `<LazyContent>`.
- API URL: `/api/location-interpretation?slug=...&date=...&age=...`.
- Skeleton matches filled height per detail page layout.
- Status text: "Generating interpretation for [location]…" (location name interpolated; only after 500ms).
- Stale-while-revalidate on filter change exactly as sub-goal 65.
- Remove `<Suspense>` around the interpretation section in `app/locations/[slug]/page.tsx`.

**Success**
- Visit `/locations/belle-isle` cold: location info, activity matrix, resources, deterministic status all paint instantly. Interpretation section shows skeleton + spinner. Browser load event fires fast.
- Interpretation streams in within seconds.
- Switch age: prior interpretation fades to 60%, new one fades in. No skeleton flash.
- Lighthouse mobile against deployed URL: still 100/100/100/100.

---

## Sub-goal 67 — Loading indicator polish + a11y verification

**Why:** New interactive surfaces (spinners, retry buttons, opacity changes) deserve a unified visual treatment and an a11y check.

**Deliverables**

- Confirm spinner visual: semantic color matching the surrounding context (subtle gray on neutral surface, brand color on prominent surfaces). 16×16 size; not so prominent it competes with content; not so subtle it's missed.
- Confirm skeleton shimmer is subtle enough to not be distracting at 375px viewport in bright daylight (target user: parent at the river checking the app).
- Confirm status text appearance timing: 500ms delay before showing, so a warm-cache 50ms response doesn't flash text.
- Keyboard walkthrough of every async surface: tab to retry button on error, Enter retries; focus state visible.
- Screen reader pass (VoiceOver): when content arrives, aria-live="polite" announces a brief summary ("Recommendations loaded" or similar). When loading begins, aria-busy is set so AT users know to expect content.
- Run `npx -y modern-web-guidance@latest retrieve performance,accessibility` and verify our patterns match the current recommendations.
- Lighthouse mobile against `/` and `/locations/belle-isle` after deploy: 100/100/100/100 retained.
- `prefers-reduced-motion` test: enable in OS settings, confirm spinner and shimmer don't animate.

**Success**
- All four states (initial-loading, stale-while-revalidating, success, error-with-retry) look polished and consistent across `/` and `/locations/[slug]`.
- A11y checks all pass.
- Lighthouse retained.
- No regression in any prior round's success criteria.

---

## Execution rules for the agent

- Run 63 → 64 → 65 → 66 → 67 in order. 63 unblocks 64 (the wrapper needs a target URL). 65 and 66 are parallelizable but easier to do sequentially.
- After sub-goal 64: **STOP and demo**. The wrapper is the foundation; verify the four states render correctly in `/_dev/lazy-content` before migrating real components on top of it.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` after each sub-goal. Plus `pnpm test` after 64.
- Do not deploy after each sub-goal. Single deploy at the end.
- **Do not regress Lighthouse mobile from 100/100/100/100.** This is a hard constraint. If a sub-goal lands and Lighthouse drops, investigate before moving forward.
- The deterministic Supabase content (river segment, location cards, advisories, resources) is **not in scope for this round**. Do not touch its rendering path. Server Components for those stay as they are.
- Use `git` for all changes. Commit per sub-goal.

## Critical files

- `app/api/metro-summary/route.ts` — sub-goal 63 (new)
- `app/api/location-interpretation/route.ts` — sub-goal 63 (new)
- `components/ui/LazyContent.tsx` — sub-goal 64 (new)
- `components/ui/Spinner.tsx` — sub-goal 64 (new)
- `components/ui/SkeletonShimmer.tsx` — sub-goal 64 (new)
- `app/_dev/lazy-content/page.tsx` — sub-goal 64 (dev-only showcase)
- `components/metro/MetroSummaryPanel.tsx` — sub-goal 65 (becomes client component)
- `app/page.tsx` — sub-goal 65 (remove `<Suspense>` around metro summary)
- `app/locations/[slug]/page.tsx` — sub-goal 66 (remove `<Suspense>` around interpretation)
- Existing `components/metro/MetroSummaryPanelSkeleton` / equivalent skeleton components — preserve and reuse via the new wrapper

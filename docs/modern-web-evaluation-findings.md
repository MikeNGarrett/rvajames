# RVA James — Modern Web Evaluation Findings

Evaluated: 2026-05-24  
URLs: `https://rvajames.org/` (primary), `/locations/belle-isle`, `/safety`, `/status`  
Tools: **lhci 0.15.1**, 3-run median (correct baseline); also single-run `npx lighthouse` to capture cache-miss worst case. `modern-web-guidance` CLI (GoogleChrome), curl header inspection, Supabase query, manual code review.

---

## Summary

**Overall posture**: The app is architecturally clean — Server Components, thin client bundle, self-hosted fonts, no third-party requests in the critical JS path. **On warm cache (typical returning visitor) the performance posture is excellent: Performance 99, LCP 1.6 s, CLS ~0.** The risk is the cache-miss worst case: when the AI generates fresh (new date/age bucket or expired row), LCP reaches 9.4 s and CLS rises to 0.15. The lhci 3-run spread exposes this: two runs hit the cache (LCP 1.5–1.6 s, CLS ≈ 0) and one did not (LCP 1.9 s, CLS 0.15). The single-run `npx lighthouse` baseline was captured on a cold cache and showed the worst case.

**lhci baseline (3-run median, homepage, mobile)**

| Category | Median score | Run range |
|---|---|---|
| Performance | 99 | 93–100 |
| Accessibility | 96 | 96–96 |
| Best Practices | 96 | 96–96 |
| SEO | 100 | 100–100 |

Median CWV: LCP 1,623 ms · CLS 0.0004 · TBT 24 ms · FCP 1,623 ms · Speed Index 2,258 ms

Cache-miss worst case (single `npx lighthouse` run, cold generation): LCP 9,451 ms · CLS 0.1457 · Performance 69

**Top 3 wins to ship in the next round**
1. **Harden the cache-miss path** — ensure `metro_summaries` is always warm (background revalidation or a tighter stale-while-revalidate TTL). If a generation takes 8 s, the first visitor on a new date sees a degraded experience even though cached users see Performance 99.
2. **Fix `metadataBase` to `https://rvajames.org`** — OG images and canonical links are currently pointing at the wrong domain, breaking social sharing.
3. **Add security response headers** — no CSP, no `X-Frame-Options`, no `X-Content-Type-Options` at the app level.

**Top 3 follow-up investigations**
1. Cloudflare Worker response headers — add security layer (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
2. Static asset immutable caching — the `_next/static/` files have content-hash names but `max-age=0`. An OpenNext/wrangler config change would set them to `immutable`.
3. `text-text-muted` contrast — `#718096` on white is ~4.2:1 (marginal AA) and the `/60` opacity variant is ~2.5:1 (fails).

---

## Findings

### Finding 1 — Cache-miss LCP reaches 9.5 s; warm-cache LCP is 1.6 s
- **Severity**: medium (warm cache is excellent; risk is first-visit or expired cache)
- **Scope**: `app/page.tsx`, `components/metro/MetroSummaryPanel.tsx`, `lib/queries/metro-summary.ts`
- **Evidence**: lhci 3-run spread: Run 1 LCP 1,623 ms (Performance 99), Run 2 LCP 1,918 ms (Performance 93, CLS 0.1457), Run 3 LCP 1,496 ms (Performance 100). Single `npx lighthouse` cold-cache run: LCP 9,451 ms, Performance 69. The `<Suspense>` wrapping `MetroSummaryPanel` renders a skeleton first; on a cache miss the Anthropic call takes 3–8 s, pushing LCP and CLS to bad territory. On cache hit, the RSC chunk resolves quickly and LCP stays ~1.6 s. Run 2's elevated CLS (0.1457) coincided with a cache miss — the skeleton→content swap fired mid-measurement.
- **modern-web-guidance recommendation** (guide `performance`): "DO declare the LCP element in standard HTML… Avoid relying on JavaScript to mount the LCP element." For RSC streaming: the deterministic content above the Suspense fold should be sized to be the LCP candidate.
- **Suggested resolution**: (a) Keep the Suspense pattern but guarantee the cache is always warm — add a background revalidation cron that pre-generates `metro_summaries` for the current date × all 6 age buckets before users visit. (b) As a fallback, set a skeleton `min-height` matching the filled panel height to eliminate CLS on cache miss.
- **Effort**: 4h–1d

---

### Finding 2 — CLS 0.15 on cache miss: Suspense skeleton ≠ panel height
- **Severity**: medium (only manifests on cache miss; warm-cache CLS 0.0004)
- **Scope**: `components/metro/MetroSummaryPanel.tsx` (`MetroSummaryPanelSkeleton`)
- **Evidence**: lhci Run 2 (cache-miss run): CLS 0.1457. Runs 1 and 3 (cache hits): CLS 0.0004 and 0.0000. The skeleton is a fixed short stub; the filled `MetroSummaryPanel` with body text, activity grid, and best bets is ~3× taller. When the Suspense resolves late, the shift pushes all location cards down.
- **modern-web-guidance recommendation** (guide `performance`): "DO pair `content-visibility` with `contain-intrinsic-size`: Prevent layout shifts and scrollbar jumping by providing a placeholder height/width."
- **Suggested resolution**: Give `MetroSummaryPanelSkeleton` `min-height: 16rem` (measured against the filled panel at ~256 px). This reserves space so the shift amplitude is zero even when the boundary resolves late.
- **Effort**: 1–4h

---

### Finding 3 — `metadataBase` set to workers.dev, not rvajames.org
- **Severity**: high
- **Scope**: `app/layout.tsx` line 9 (`metadataBase: new URL('https://rva-james.workers.dev')`)
- **Evidence**: Code read: `metadataBase: new URL('https://rva-james.workers.dev')`. All resolved OG URLs and canonical links produced by Next.js Metadata API will use the workers.dev hostname. Social preview images and link previews will be wrong or broken for any `/opengraph-image` route.
- **modern-web-guidance recommendation** (guide `performance`): Canonical URLs in OG metadata must match the production origin.
- **Suggested resolution**: Change to `metadataBase: new URL('https://rvajames.org')`.
- **Effort**: <1h

---

### Finding 4 — `text-text-muted` fails AA contrast; `/60` opacity fails badly
- **Severity**: high
- **Scope**: `globals.css` (`--color-text-muted: #718096`), all uses of `text-text-muted` and `text-text-muted/60`
- **Evidence**: Lighthouse flags 5 color-contrast failures on elements using `text-xs text-text-muted` and `text-text-muted/60`. Calculated contrast: `#718096` on `#ffffff` ≈ 4.2:1 (marginal for normal text, the minimum is 4.5:1). At 60% opacity the effective color is `#a6b0bc`, contrast ≈ 2.6:1 — well below WCAG AA. Affected elements include gauge sub-labels ("Westham gauge (upriver)", "USGS 02037500"), the cfs/temp readings, and the datum disclaimer.
- **modern-web-guidance recommendation** (guide `accessibility`): "Text on a coloured background must meet WCAG 2.1 AA minimum contrast ratios: 4.5:1 for normal text, 3:1 for large text (≥18 pt or ≥14 pt bold)."
- **Suggested resolution**: Darken `--color-text-muted` to `#5d6b82` (≈5.1:1 on white) and replace `text-text-muted/60` usage with a dedicated `--color-text-subtle` token defined at a legible contrast ratio rather than an opacity shorthand.
- **Effort**: 1–4h

---

### Finding 5 — Accessible name mismatch on location card links (WCAG 2.5.3)
- **Severity**: high
- **Scope**: `components/tiles/RiverLevelTile.tsx`
- **Evidence**: Lighthouse `label-content-name-mismatch` audit flags all 9 location cards. The `<Link>` has `aria-label={`${location.name} — ${label}`}` (e.g. `"Belle Isle — Normal flow"`) but the visible `<StatusBadge>` renders "Safe". WCAG 2.5.3 requires the accessible name to contain all visible text in the control; "Normal flow" is not visible ("Safe" from the badge is). Screen readers announce "Belle Isle — Normal flow" while sighted users see "Safe".
- **modern-web-guidance recommendation** (guide `accessibility`): "Visible label text must be contained in the accessible name (WCAG 2.5.3)."
- **Suggested resolution**: Either (a) remove the `aria-label` entirely (letting AT read the composed content — name + badge text + reason), or (b) change it to `aria-label={`${location.name} — ${StatusBadge label} — ${reason}`}` ensuring every visible word is covered.
- **Effort**: <1h

---

### Finding 6 — `cache-control: no-store` disables BF-Cache on every page
- **Severity**: medium
- **Scope**: All pages (Cloudflare Worker response, `app/page.tsx`, `/locations/[slug]/page.tsx`)
- **Evidence**: HTTP response headers: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`. Lighthouse `bf-cache` audit: "Pages whose main resource has cache-control:no-store cannot enter back/forward cache." When users navigate from a location detail page back to the homepage, the browser must do a full server round-trip instead of restoring from BF-Cache.
- **modern-web-guidance recommendation** (guide `performance`): BF-Cache is the single highest-impact performance optimization for repeat navigation. `no-store` permanently disables it; prefer `no-cache` (or `max-age=0, must-revalidate`) which still allows BF-Cache while requiring revalidation.
- **Suggested resolution**: Change the Worker's HTML response cache header from `no-store` to `no-cache` (or `max-age=60, stale-while-revalidate=300` for a short fresh window). The dynamic nature of the data is already handled by server-side revalidation; `no-store` is unnecessarily punitive. This is likely an OpenNext or Next.js `dynamic = 'force-dynamic'` default — override it in a Cloudflare Worker response middleware.
- **Effort**: 1–4h

---

### Finding 7 — Static assets missing `immutable` cache directive
- **Severity**: medium
- **Scope**: `/_next/static/**` (JS chunks, CSS, WOFF2 font)
- **Evidence**: Curl check: `cache-control: public, max-age=0, must-revalidate` on `/_next/static/css/9dd9261e4bca4120.css` and `/_next/static/media/68180864d7f93f02-s.p.woff2`. These filenames contain a content hash — they are safe to cache indefinitely. `max-age=0` forces ETag revalidation on every page load (a round-trip per file, even if 304 comes back).
- **modern-web-guidance recommendation** (guide `performance`): Content-addressed assets (hash in filename) should be served with `public, max-age=31536000, immutable` for maximum cache efficiency.
- **Suggested resolution**: In `wrangler.jsonc`, add a custom header rule for the `/_next/static/` path pattern: `cache-control: public, max-age=31536000, immutable`. OpenNext should support this via Workers routing rules or a custom middleware.
- **Effort**: 1–4h

---

### Finding 8 — Missing security response headers
- **Severity**: medium
- **Scope**: All routes (Cloudflare Worker responses)
- **Evidence**: Curl check of `https://rvajames.org/` shows none of: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or `Strict-Transport-Security` (at the app level; Cloudflare's CDN may add HSTS at the edge but it is not app-controlled).
- **modern-web-guidance recommendation** (guide `security`): "Phase 1 Quick Wins — X-Frame-Options: SAMEORIGIN carries extremely low breakage risk and provides immediate clickjacking protection." `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` are similarly zero-risk.
- **Suggested resolution**: Add a response header middleware in the Cloudflare Worker (or via `wrangler.jsonc` `headers` rules):
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  ```
  Reserve CSP for a follow-up sub-goal after report-only auditing (see guide `security`, Phase 2).
- **Effort**: 1–4h

---

### Finding 9 — favicon.ico returns 404
- **Severity**: medium
- **Scope**: `public/favicon.ico` or `app/favicon.ico`
- **Evidence**: Network request log: `404 https://rvajames.org/favicon.ico`. Console error in Lighthouse. Browsers request favicon on every navigation; 404 adds a failed network request and a console error for every user.
- **Suggested resolution**: Place a favicon at `app/favicon.ico` (Next.js App Router auto-serves it from there). A 32×32 or 64×64 `.ico` or `.png` is sufficient; a simple wave or "RJ" monogram in Richmond blue would match brand.
- **Effort**: <1h

---

### Finding 10 — Cloudflare Web Analytics beacon is a third-party CDN request
- **Severity**: medium
- **Scope**: `app/layout.tsx` or Cloudflare dashboard auto-injection
- **Evidence**: Network request: `https://static.cloudflareinsights.com/beacon.min.js/v833...` (11 KB, third-party origin). This requires a separate DNS lookup and TLS handshake to a CDN subdomain not on the primary origin. Even with `defer`, it adds to resource contention.
- **modern-web-guidance recommendation** (guide `performance`): "DO self-host critical third-party dependencies: Reduce DNS lookups and enforce custom Cache-Control logic by hosting third-party libraries on the origin domain."
- **Suggested resolution**: Either (a) download and self-host the Cloudflare beacon at `/_cf-beacon.js` with an immutable cache header, or (b) add `<link rel="preconnect" href="https://static.cloudflareinsights.com">` to reduce the DNS/TLS cost. Option (b) is the 10-minute version; (a) is cleaner but requires a script update strategy.
- **Effort**: <1h (preconnect) or 4h–1d (self-host)

---

### Finding 11 — `metroAdvisories` label in RiverLevelTile aria-label uses rules-engine label, not badge text
- **Severity**: medium
- **Scope**: `components/tiles/RiverLevelTile.tsx` (duplicate of Finding 5 root, different symptom)
- **Evidence**: The `deterministicStatus.label` used in `aria-label` (e.g. "Normal flow") is not visible anywhere on the card. The `StatusBadge` renders "Safe"/"Caution"/"High Risk". These are different strings. Even if WCAG 2.5.3 were satisfied by containing "Normal flow" in the label, "Normal flow" text is invisible to sighted users — it only exists in the AT flow. This is confusing for screen reader users who navigate by link text.
- **Suggested resolution**: Consolidate: either expose the `label` text visually (as a sub-text beneath the badge), or drop it from `aria-label` (see Finding 5).
- **Effort**: <1h

---

### Finding 12 — Legacy JavaScript polyfills: ~11 KB estimated savings
- **Severity**: low
- **Scope**: JS bundles served to modern browsers
- **Evidence**: Lighthouse `legacy-javascript-insight` audit: "Est. savings of 11 KiB." The polyfills targeted at browsers below Next.js's `browserslist` floor are shipping to modern mobile browsers that don't need them.
- **modern-web-guidance recommendation** (guide `performance`): "DO use `async` or `defer` for all non-critical scripts…DON'T load invisible or unreachable CSS/JS." The browserslist default can often be narrowed for SPA/PWA dashboards that target evergreen browsers.
- **Suggested resolution**: Add `browserslist: "> 0.5%, last 2 versions, not dead, not ie 11"` to `package.json` or `.browserslistrc`. Re-check with `npx browserslist --stats`.
- **Effort**: 1–4h

---

### Finding 13 — No dark mode support
- **Severity**: low
- **Scope**: `app/globals.css` (all color tokens are fixed light values)
- **Evidence**: The design token system defines only one color set (light mode). No `@media (prefers-color-scheme: dark)` block exists. On iOS/Android with system dark mode active, users see the full-brightness light theme.
- **modern-web-guidance recommendation** (guide `dark-mode`): "Use `light-dark()` CSS function and `color-scheme: light dark` to respect the user's OS preference without duplicating all token definitions."
- **Suggested resolution**: Add `color-scheme: light dark` to the `:root`. Define a set of dark-mode overrides for surface, text, and border tokens using `@media (prefers-color-scheme: dark)` and the `light-dark()` function. Status semantic colors (safe/caution/danger) likely need only a brightness/saturation adjustment.
- **Effort**: >1d (new design token layer)

---

### Finding 14 — Nunito Sans `display: swap` may cause FOUT / CLS on slow connections
- **Severity**: low
- **Scope**: `app/layout.tsx` (`display: 'swap'` on `Nunito_Sans`)
- **Evidence**: The HTTP 103 Early Hint and `<link rel="preload">` for the WOFF2 are present (good). However, on very slow connections the preload may not finish before first paint, causing a flash of fallback text (FOUT) followed by a layout shift as Nunito Sans loads. The current `display: swap` is better than `block` but worse than a well-tuned `optional` or `fallback` with `font-size-adjust`.
- **modern-web-guidance recommendation** (guide `visually-stable-font-fallbacks`): "Define font styles such that text remains readable and visually consistent in the event that there's a swap between the preferred font and one of the fallbacks. Use `font-size-adjust` to match the fallback metrics."
- **Suggested resolution**: Compute `font-size-adjust` value between Nunito Sans and Arial (the CSS `size-adjust` descriptor), or switch to `display: optional` which never causes FOUT (font only applies if it loads within 100ms).
- **Effort**: 1–4h

---

### Finding 15 — `ConditionsForm` uses `router.push` instead of `nuqs` setters
- **Severity**: low
- **Scope**: `components/filters/ConditionsForm.tsx`
- **Evidence**: On form submit, `router.push('/?date=...&age=...')` triggers a full App Router client-side navigation, re-rendering the entire page tree. `nuqs` (already in `package.json`) provides `useQueryState` which batches URL parameter updates into a `replaceState` call and notifies Server Components via shallow push — no full navigation required. The `useTransition` wrapper helps but doesn't eliminate the cost.
- **modern-web-guidance recommendation** (guide `forms`): "Use the browser's native form submission patterns… Avoid programmatic navigation for filter/search state; prefer History API `replaceState` or URL-aware state managers."
- **Suggested resolution**: Replace `useState` + `router.push` with `nuqs`'s `useQueryStates` hook which manages both date and age bucket. Removes the manual `hasChanged` check, removes the full page re-render, and keeps URL state in sync automatically.
- **Effort**: 1–4h

---

### Finding 16 — View Transitions not used for date/age filter navigation
- **Severity**: low
- **Scope**: `components/filters/ConditionsForm.tsx`, `app/page.tsx`
- **Evidence**: When the user changes date or age bucket, the page re-renders deterministically — status badges, gage readings, and the metro summary all update. This is a clear View Transition candidate: shared elements (status badges, the river panel) could morph in place rather than abruptly replacing.
- **modern-web-guidance recommendation** (guide `same-document-transitions`): "Visually connect persisting elements across different page states in a SPA by smoothly morphing their size, position, or other styling properties." The API is ready for use (Chrome 111+, Safari 18+).
- **Suggested resolution**: Wrap the `router.push` transition in `document.startViewTransition(() => startTransition(...))`. Assign `view-transition-name` CSS properties to the `RiverSegmentPanel` and the status badge group. No visual change if the browser doesn't support it — progressive enhancement.
- **Effort**: 4h–1d

---

### Finding 17 — No CSP header; security posture relies solely on Cloudflare defaults
- **Severity**: low
- **Scope**: All routes
- **Evidence**: Curl shows no `Content-Security-Policy` header (not even report-only). Lighthouse `csp-xss` audit returns score 1 only because there are no inline scripts beyond what Next.js hydration produces. Without a CSP, any future `dangerouslySetInnerHTML` or third-party script injection would have no enforcement.
- **modern-web-guidance recommendation** (guide `security`, Phase 2): "Deploy Report-Only Policies as a prerequisite for any Phase 3 enforcement." Start with `Content-Security-Policy-Report-Only: default-src 'self'; report-to csp-endpoint` to discover what would break before enforcing.
- **Suggested resolution**: As a first step, deploy `Content-Security-Policy-Report-Only` with a Supabase endpoint as the report target. This has zero risk of breakage. Review the report after 24h, then move to enforcement.
- **Effort**: 1–4h (report-only), >1d (enforced)

---

### Finding 18 — `ingestion_runs` INSERT silently fails; some cron fires produce no audit log
- **Severity**: low
- **Scope**: `lib/ingest/run.ts` (`withIngestionRun`)
- **Evidence**: `conditions_snapshots` has rows at 21:32 and 21:39 with no corresponding `ingestion_runs` entries. The `withIngestionRun` code does not check the error from the INSERT — if `supabase.from('ingestion_runs').insert(...)` fails, `run` is null and the function silently continues with no log row created. Also observed: two rows with `finished_at = null` and `ok = null` (starts logged, finish never written — likely Worker CPU-timeout).
- **Suggested resolution**: Destructure `{ data: run, error: runInsertErr }` and log `runInsertErr` to console if set. Add a `try/finally` to ensure the UPDATE runs even if `fn()` throws. These changes make the audit log reliable and expose the root cause when the Worker is killed mid-execution.
- **Effort**: <1h

---

### Finding 19 — Homepage `<h2>` used for both section headers and all 9 location names
- **Severity**: low
- **Scope**: `components/metro/RiverSegmentPanel.tsx`, `components/tiles/RiverLevelTile.tsx`
- **Evidence**: `RiverSegmentPanel` renders `<h2>River conditions</h2>`. Each `RiverLevelTile` also renders `<h2>{location.name}</h2>`. Lighthouse `heading-order` passes (all h2s under h1), but the flat heading hierarchy means screen reader users navigating by heading see "River conditions", "Belle Isle", "Browns Island", … as peers with no structural grouping.
- **Suggested resolution**: Wrap the location grid in a section with its own `<h2>Locations</h2>` (or an `aria-label`) and change each tile's heading to `<h3>`. Or demote `RiverSegmentPanel`'s `<h2>` to a visually-styled `<p>` with `role="heading" aria-level="2"` to preserve the level while letting location names be at h2.
- **Effort**: <1h

---

### Finding 20 — No OpenGraph image defined; OG `type: website` is minimal
- **Severity**: low
- **Scope**: `app/layout.tsx` (`metadata.openGraph`)
- **Evidence**: The `openGraph` block has only `siteName` and `type: 'website'`. No `og:image`, `og:description`, or `og:url` defined. When shared on social platforms, the preview will show just a URL bar and no card.
- **Suggested resolution**: Add an `app/opengraph-image.tsx` (Next.js App Router convention) that renders a server-side OG image with the current conditions summary. Or add a static fallback image. Also fix `metadataBase` (Finding 3) first, since OG image URLs depend on it.
- **Effort**: 4h–1d

---

### Finding 21 — Speculation Rules are Cloudflare-managed, not app-controlled
- **Severity**: nit
- **Scope**: Cloudflare edge layer; `app/` (no app-level rules exist)
- **Evidence**: Response header: `speculation-rules: "/cdn-cgi/speculation"`. Cloudflare injects document-rule-based speculation rules at the CDN level. Network logs show the browser prefetched several location pages (`/locations/belle-isle?_rsc=...`). The prefetch is generic (all links on page) rather than targeted at the highest-value navigation flows.
- **modern-web-guidance recommendation** (guide `improve-next-page-load-performance`): "Add a `<script type='speculationrules'>` to the page to precisely control which URLs are prerendered (higher fidelity than prefetch)." App-controlled rules can limit to the 3 "best bets today" location slugs rather than all 9 cards.
- **Suggested resolution**: Add a dynamic `<script type="speculationrules">` in `MetroSummaryPanel` (or in the Suspense-resolved content) that targets the `best_bets_today` slugs with `"eagerness": "moderate"`. Cloudflare rules are a good floor; this replaces them with a ceiling.
- **Effort**: 1–4h

---

### Finding 22 — `color-mix()` / `light-dark()` not used for semantic color variants
- **Severity**: nit
- **Scope**: `app/globals.css` (color token definitions)
- **Evidence**: The `subtle` variants (e.g. `--color-status-safe-subtle: #eaf5e2`) are hard-coded hex values. With CSS `color-mix()`, these can be derived from the base color: `color-mix(in srgb, var(--color-status-safe) 15%, white)`. This eliminates manual derivation and keeps subtle variants automatically in sync if the base color changes.
- **modern-web-guidance recommendation** (guide `css`): "`color-mix()` lets you define tints/shades of a color without hardcoding every stop. Supported in all modern browsers (Chrome 111+, Safari 16.2+)."
- **Suggested resolution**: Replace the 4 subtle hex values with `color-mix()` derivations. Zero visual change; purely a maintainability improvement.
- **Effort**: <1h

---

### Finding 23 — Container queries not used; grid layout uses global breakpoints
- **Severity**: nit
- **Scope**: `components/metro/RiverWideActivityGrid.tsx` (`md:grid-cols-4`), `components/metro/RiverSegmentPanel.tsx` (`grid grid-cols-2`)
- **Evidence**: The 2×2→4×1 activity grid and the gauge panel grid use `md:` global breakpoints. If these panels are ever placed in a narrower sidebar context, the layouts will break. Container queries (Tailwind v4 supports `@container` natively) would make them composable regardless of context.
- **modern-web-guidance recommendation** (guide `fluid-scaling`): "Scale items based on the parent container's size rather than using fixed breakpoints."
- **Suggested resolution**: Add `@container` on the panel wrappers and change `md:grid-cols-4` to `@md:grid-cols-4`. Low-risk since the app currently has a single `max-w-lg` column layout, but this future-proofs the components.
- **Effort**: <1h

---

## Out of scope but noted

- **`/brand` returns 404 in production** — the route exists in source (`app/brand/page.tsx`) but either the page is gated server-side or the static prerender threw. Confirm whether this is intentional.
- **`water_temp_f` null for both gauges** — the latest USGS snapshots have `water_temp_f = null`. Station `02037705` doesn't report 00010, but `02037500` should. May be a USGS provisional data gap or the API parameter request needs investigation.
- **`ingestion_runs` rows with `finished_at = null`** — two stuck rows from earlier runs (20:07 and 20:10) where the Worker was likely killed mid-execution. These rows should either be cleaned up or given a `failed_at` timestamp.
- **`ConditionsForm` button accessible label** — `aria-label="Show conditions"` on the button, while the visible text is "Show". The accessible name contains more context than the visible label (safe under WCAG 2.5.3) but inconsistent with design system.
- **`prefers-reduced-motion` not handled** — The spinner animation in `ConditionsForm` and the `animate-pulse` skeleton should be gated with `@media (prefers-reduced-motion: reduce)`.
- **`/locations/belle-isle` OpenGraph image route** — An `app/locations/[slug]/opengraph-image` route exists. With `metadataBase` wrong (Finding 3), these OG images will have the wrong origin in their resolved URLs.
- **Cloudflare Beacon self-injection** — The `beacon.min.js` appears to be injected by Cloudflare automatically (not from app code). Disabling it in the Cloudflare dashboard or switching to server-side analytics would remove the third-party request entirely.

# RVA James — Audit Reconciliation

Cross-references each finding from `modern-web-evaluation-findings.md` against the staged plans, with **actual current state verified against the git history and codebase**.

**Last reconciled: 2026-05-26** (complete — all 23 findings resolved; Finding 13 dark mode explicitly deferred; water-quality pipeline sub-goals 68–73 shipped; date-range-forecast sub-goals 74–79 shipped; advisory structural dedup shipped; React #418 hydration mismatch root-caused and fixed). Earlier versions of this doc significantly understated what had shipped — the team had been executing in parallel sessions faster than the doc was being updated. This version is built from `git log` and direct codebase inspection.

---

## Status of all 23 audit findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | high | LCP inside Suspense boundary inflates to ~9.5 s | ✅ **DONE** — Round 3 sub-goal 38 (commit `d722386`). Deterministic hero is now the LCP element. |
| 2 | high | CLS skeleton ≠ panel height | ✅ **DONE** — Round 5 (commit `581c4be`). |
| 3 | high | `metadataBase` is workers.dev | ✅ **DONE** — Round 5 and Round 6 (commits `581c4be`, `dc16684`). |
| 4 | high | `text-text-muted` fails AA contrast | ✅ **DONE** — Round 5 (commit `581c4be`). |
| 5 / 11 | high / medium | Location card aria-label mismatch (WCAG 2.5.3) | ✅ **DONE** — Round 3 sub-goal 38 (commit `d722386`). |
| 6 | medium | `cache-control: no-store` disables BF-Cache | ✅ **DONE** — Round 6 (commit `dc16684`). |
| 7 | medium | Static assets missing `immutable` directive | ✅ **DONE** — Round 6 (commit `dc16684`). |
| 8 | medium | Missing security headers (XFO, XCTO, Referrer-Policy, Permissions-Policy) | ✅ **DONE** — Round 6 (commit `dc16684`). |
| 9 | medium | favicon.ico returns 404 | ✅ **DONE** — Round 5/6 (commits `581c4be`, `dc16684`). |
| 10 | medium | Cloudflare beacon third-party request | ✅ **DONE** — `<link rel="preconnect">` + dns-prefetch for static.cloudflareinsights.com added to `app/layout.tsx`; beacon domains added to CSP script-src + connect-src (`14e8a00`). |
| 12 | low | Legacy JS polyfills (~11 KB) | ✅ **DONE** — Round 8. `browserslist` targeting last 2 versions of Chrome/Firefox/Safari/Edge added to `package.json` (`4401179`). |
| 13 | low | No dark mode support | ⏳ **DEFERRED** — own round if/when prioritized. |
| 14 | low | Nunito Sans `display: swap` FOUT/CLS risk | ✅ **DONE** — Round 8. Switched to `display: 'optional'`; eliminates FOUT and CLS entirely (`4401179`). |
| 15 | low | `ConditionsForm` uses `router.push` instead of `nuqs` setters | ✅ **DONE** — Round 7. `useQueryStates` with `shallow:false` replaces `router.push` (`eebf1a3`). |
| 16 | low | View Transitions not used for filter navigation | ✅ **DONE** — Round 7. `document.startViewTransition()` wraps param update; `view-transition-name` on RiverSegmentPanel + MetroSummaryPanel (`eebf1a3`). |
| 17 | low | No CSP — start with Report-Only | ✅ **DONE** — `Content-Security-Policy-Report-Only` deployed (`0723474`). Verified live on rvajames.org via curl. |
| 18 | low | `withIngestionRun` swallows INSERT errors | ✅ **DONE** — verified in `lib/ingest/run.ts` with explicit `// (Finding 18)` comment. |
| 19 | low | Flat heading hierarchy (all `<h2>`) | ✅ **DONE** — Round 3 sub-goal 38 (commit `d722386`). |
| 20 | low | No OG image defined | ✅ **DONE** — Round 8. `app/opengraph-image.tsx` deployed; auto-wires `og:image` + `twitter:image`; no `runtime='edge'` export (breaks OpenNext) (`5a48abb`). |
| 21 | nit | Speculation rules are CDN-default | ✅ **DONE** — Round 3 sub-goal 38 (commit `d722386`). |
| 22 | nit | `color-mix()` not used for subtle variants | ✅ **DONE** — Round 5 (commit `581c4be`). |
| 23 | nit | Container queries not used for activity grid | ✅ **DONE** — Round 9 sub-goal 51. `RiverWideActivityGrid` uses `@container` + `@md:grid-cols-4`. |

**Summary:** 22 ✅ done · 0 ⚠️ · 1 ⏳ pending (dark mode — explicitly deferred).

---

## Out-of-scope notes — disposition

| Item | Status |
|---|---|
| `/brand` returns 404 in production | ✅ **DONE** — verified gated in Round 5. |
| `water_temp_f` null for both gauges | ✅ **DONE** — Neither Richmond gauge has a temp sensor. Added USGS 02035000 (Cartersville, ~40 mi upstream) as a proxy in `lib/ingest/usgs.ts`; its reading is used as a fallback when `waterTempF` is null (`14e8a00`). |
| `ingestion_runs` stuck rows (finished_at null) | ✅ Resolved by Finding 18 fix (new runs are reliable; legacy stuck rows can be cleaned in a SQL one-liner if desired). |
| `ConditionsForm` button aria-label | ✅ **DONE** — resolved as part of Round 7 ConditionsForm modernization (`eebf1a3`). |
| `prefers-reduced-motion` not handled | ✅ **DONE** — Round 5. |
| `/locations/[slug]/opengraph-image` URL origin | ✅ Fixed by Finding 3 fix. Full OG image work is still Round 8 / Finding 20. |
| Cloudflare beacon self-injection vs. disable | ✅ **DONE** — preconnect + dns-prefetch hints added; beacon domains in CSP (`14e8a00`). Full self-host not needed — preconnect eliminates the latency penalty. |

---

## Round-by-round actual status (verified against git history + codebase)

| Round | Scope | Status | Reference commits |
|---|---|---|---|
| Feedback Round 1 (sub-goals 1–28) | Initial app build, ingestion, AI, dashboard, deploy hardening | ✅ COMPLETE | `158297a`, `852428e` |
| Round 2 (sub-goals 29–34) | Homepage rapids redesign — activity grid, rapids class | ✅ COMPLETE | `84f42cd` |
| Round 3 (sub-goals 35–40) | River conditions redesign — gauge bar, sparkline, detail modal, LCP fix | ✅ COMPLETE | `d722386`, `9b4991d` |
| Round 4 sub-goal 41 | howsthejamesrva.com investigation | ✅ COMPLETE | `926c1da` |
| Round 4 sub-goal 42 | NOAA AHPS forecast + detail modal section | ✅ COMPLETE | `9e33ae3` |
| Round 4 sub-goal 43 | Operational status schema + rules override + 'closed' status | ✅ COMPLETE | `eaffe00` |
| Round 4 sub-goal 44 | Admin UI for closures (`/admin/closures`) | ✅ COMPLETE | `581c4be` |
| Round 4 sub-goal 45 | rva.gov closure scraper + review queue | ✅ COMPLETE | `86e70e2` |
| Round 4 sub-goal 46 | Surface closures across the app | ✅ COMPLETE | `cef2111` + follow-up |
| Round 4 sub-goal 47 | A11y + perf verification + modern-web pass | ✅ COMPLETE — Lighthouse mobile Performance 100, Accessibility 100 (up from 97/96), all CWV green (LCP 0.6s, CLS 0, FCP 0.3s) | `9015985` |
| Sub-goal 58 | Multi-source closure registry refactor — rva-closures.ts → closures/sources/rva-gov.ts; ClosureSource interface; registry.ts; run-all.ts; DPU press-release URL added to rva-gov scrape; usgs-percentiles cron updated to runAllClosureSources() | ✅ COMPLETE | `8740502` |
| Sub-goal 59 | Venture Richmond closure source — ventureRichmondSource registered; scrapes /news/ + /browns-island-improvement-plan/; checks robots.txt; keyword + location filter; draft rows only | ✅ COMPLETE (implemented in sub-goal 58 commit) | `8740502` |
| Sub-goal 60 | Friends of JRPS closure source — jrpsSource registered; scrapes /news/ + /whats-going-on-with-pipeline/; honors JSON-LD datePublished; checks robots.txt; draft rows only | ✅ COMPLETE (implemented in sub-goal 58 commit) | `8740502` |
| Sub-goal 61 | Pipeline Trail as 10th location — migration 0010 inserts location row + active closed_indefinite status (effective 2024-09-13, no end date) + 3 location_resources; AI system prompt updated with permanent closure context | ✅ COMPLETE | `5a86bcd` |
| Sub-goal 62 | Manual admin entry — Brown's Island construction closure via /admin/closures/new (no code change needed) | ✅ COMPLETE 2026-05-25 — admin entry made via /admin/closures/new after the d275fa0 hotfix unblocked the page. |
| Hotfix: edit-closure server-component error | EditClosurePage's Danger Zone form attached an inline onSubmit handler with window.confirm inside an async server component → React 19 threw at render time, surfacing as "Application error" digest 960521385. Fixed by extending ExpireButton with a `variant='full'` option and swapping out the broken form. Both list + edit surfaces now share the confirm-dialog + undo-toast flow | ✅ COMPLETE | `d275fa0` |
| Round 5 (Items 1–9) | Audit quick wins | ✅ COMPLETE | `581c4be` |
| Round 6 (Findings 3, 6–9) | Headers, caching, BF-Cache, security | ✅ COMPLETE | `dc16684` |
| Round 9 sub-goal 48 | Responsive foundation + `docs/responsive-guidelines.md` | ✅ COMPLETE | `581c4be` |
| Hotfix: cron scheduled() export | All 5 Cloudflare cron triggers failing ("Handler does not export a scheduled() function") — added `scripts/patch-worker.mjs` post-build patch | ✅ COMPLETE | `84bf880` |
| Hotfix: HorizontalGauge responsive | SVG `preserveAspectRatio="none"` caused stretching + "Flood" label clipped — rewrote as CSS | ✅ COMPLETE | `84bf880` |
| Hotfix: Sparkline flat-line | normalBand forced Y-axis to 0–4 ft, collapsing ~0.2 ft variation — Y range now derived from data only | ✅ COMPLETE | `de8bc4f` |
| Hotfix: Admin double-confirmation | Expire + Discard actions had no confirmation — added `ConfirmActionButton` client component | ✅ COMPLETE | `84bf880` |
| Hotfix: Typography minimum size | `--text-xs` bumped 12px→13px (0.8125rem), `--text-sm` bumped 14px→16px (1rem); removed `text-[7px]` from HorizontalGauge band labels | ✅ COMPLETE | `e48c05e` |
| Hotfix: CSO ingest dead URLs | Original rva.gov CSO URLs (both 404); switched to DPU news RSS feed + wastewater page scrape with proper source-unavailable vs. no-advisory distinction | ✅ COMPLETE | `e48c05e` |
| Sub-goals 53–57: Admin safety & a11y | Native `<dialog>` confirm modal, type-to-confirm for Discard, Expire undo toast, visual safe/destructive separation, a11y audit (`scope="col"`, `aria-errormessage`) | ✅ COMPLETE | `a1c71a5`–`dc12e7e` |
| Round 9 sub-goals 49–52 | Responsive application across routes/components/container queries/visual regression | ✅ COMPLETE | `ef33f83`–`9973852` |
| Round 7 (Findings 15, 16) | ConditionsForm modernization (nuqs setters + View Transitions) | ✅ COMPLETE | `eebf1a3` |
| Round 8 (Findings 12, 14, 20) | Polish — browserslist, font display:optional, OG image route | ✅ COMPLETE | `4401179`, `5a48abb` |
| Round 9+ hotfix: Sparkline dot shape | SVG `preserveAspectRatio="none"` made circle elliptical — rewrote dot as CSS `div` outside SVG with % positioning | ✅ COMPLETE | `2cbba8b` |
| Round 9+ hotfix: Sparkline height | Callsite lacked explicit `height` prop; defaulted to 40 px — set to 125 px | ✅ COMPLETE | `e0e9d72` |
| Round 9+ hotfix: CSP Report-Only (Finding 17) | `Content-Security-Policy-Report-Only` added to `middleware.ts` | ✅ COMPLETE | `0723474` |
| Water-quality sub-goal 68 | ArcGIS station-to-access-point mapping in `lib/data/station-mapping.ts` with `name` short codes (J08, J10, J20, J21, J22, J23, J24, J26, J41), `displayName` fallback, and `bacteria` capability array per station (J26 confirmed single-bacteria) | ✅ COMPLETE | `55c0a3a`, `5fd2b16` |
| Water-quality sub-goal 69 | Replace cheerio scrape with ArcGIS FeatureServer JSON ingest. Filter by stable `name` short codes (not `StationName` which is null on 2026 records); sort by `creationdate DESC`; coalesce chain for `collected_at`; -9 sentinel sanitization. Schema: `water_quality_readings` time-series table | ✅ COMPLETE | `38d2e80`, `a105349` |
| Water-quality sub-goal 70 | Derive advisories from readings — new `lib/ingest/derive-water-quality-advisories.ts` with 14-day recency window, two-state classification (single threshold = medium, 2× threshold = high), upstream-watch low-severity advisories for J24 → downstream points. `kind='water_quality'` (canonical enum value — note: not `'bacterial'`; the plan text said `bacterial` but production enum uses generic `water_quality`). Wired into `app/api/cron/jra/route.ts`. 20 new test cases | ✅ COMPLETE | `9eb853e` |
| Water-quality sub-goal 71 | Surface water quality in UI — new `components/location/WaterQualityPanel.tsx` (threshold gauge, bacteria readings, seasonal context, attribution), water-drop SVG badge on `RiverLevelTile` (blue safe / amber caution with aria-label), `WaterQualityBadge` type added to `LocationSummary`, JRA + 7-partner attribution in `DisclaimerFooter`. Also fixed pre-existing backtick-escape bug in `system-prompt.ts:276` that was blocking lint | ✅ COMPLETE | `c225980` |
| Water-quality sub-goal 72 | Wire water quality into AI reasoning — cached system prompt gained JRA program context, station roles (J24 upstream watch, single-bacteria stations), freshness rules (<7d / 7–14d / >14d), rain cross-reference rule, bacteria-vs-gage independence. Per-call uncached input now carries `waterQuality` block (primary + upstream watch readings). `computeLocationHash` includes waterQuality → natural lazy regeneration on new reading. 13 new unit tests. Smoketest verified cache hit (11240/11240 tokens) | ✅ COMPLETE | `25742cf` |
| Water-quality sub-goal 73 | A11y verification on WQ surfaces — fixed WaterDropBadge color-only signal (added `!` glyph for caution state, satisfying WCAG 1.4.1), added `(opens in new tab)` sr-only text on JRA Watch links in WaterQualityPanel + DisclaimerFooter. Verified: contrast ratios on all 7 fg/bg pairs pass AA, `HorizontalGauge` exposes `role="meter"` with valuenow/min/max/text, axe-core 0 violations on `/` and `/locations/pony-pasture` | ✅ COMPLETE | `f99a08b` |
| Deferred | Finding 13 — dark mode | ⏳ DEFERRED |
| Date-range-forecast sub-goal 74 | Forecast window + chip labels — `getForecastWindow()`, `isInWindow()`, Richmond-TZ helpers, `formatRichmondDate`/`addDaysToIso` in `date-tz.ts` | ✅ COMPLETE | `6170bfc` |
| Date-range-forecast sub-goal 75 | Forecast-aware `getTodayData` — mode field, `OutOfWindowError`, AHPS forecast data wired into query path | ✅ COMPLETE | `01aec0b` |
| Date-range-forecast sub-goal 76 | `ForecastChipPicker` (4-chip date selector, role="tablist"), `DateUnavailableBanner` (`role="alert"` focus-on-mount), `buildRedirectUrl` helper, redirect-to-today on out-of-window dates | ✅ COMPLETE | `e6f2ae9` |
| Date-range-forecast sub-goal 77 | AI forecast-mode language adaptation — cached system prompt mode section, per-call `mode`/`forecastConfidence`/`daysOut` inputs, `computeLocationHash`/`computeMetroHash` include mode+daysOut, water temp/data age suppressed in forecast | ✅ COMPLETE | `9d7a7e6` |
| Date-range-forecast sub-goal 78 | `ForecastModeIndicator` component (`<details>/<summary>` tooltip), `formatForecastDate` export, mode-aware headers on `MetroSummaryPanel` + location page, `MetroSummaryPanel` ungated for forecast dates | ✅ COMPLETE | `6854222` |
| Date-range-forecast sub-goal 79 | Final a11y + perf pass: fixed chip subtitle contrast (opacity-70 removed, was ~2.94:1), fixed label-content-name-mismatch (aria-label override dropped), deployed round. Lighthouse final: 98/100/96/100 observed, 95/100/96/100 forecast. pa11y 0 violations on 3 URLs. Pre-existing React #418 hydration warning (Best Practices 96) filed as follow-up. | ✅ COMPLETE | `17dde94`, `89f9f32` |
| Structural advisory dedup | Migration 0012: `source_id text NULL` + partial UNIQUE index `ON advisories (source, source_id) WHERE source_id IS NOT NULL`. One-time cleanup DELETE collapses NWS blind-insert duplicates. All three ingest paths refactored: NWS upserts on `alert.properties.id`, CSO upserts on `hashToHex16(headline+effectiveFrom)` (bulk-expire removed), JRA splits composite source key into `source='jra_water_quality'` + `source_id='{code}:{date}'`. Types regenerated. Commit 1 kept `dedupAdvisories()` as safety net. Commit 2 removed it once UNIQUE constraint was live. `8f65cdd` hotfix read-side defense **RETIRED** — structural constraint supersedes it. | ✅ COMPLETE — migration applied to prod; code deployed in sub-goal 79 deploy; 0 `(source, source_id)` duplicates in prod | `2950e4b`, `929ce08` |
| React #418 hydration mismatch fix | Root cause: `RiverConditionsDetailDialog` (Client Component) called `new Date(ts).toLocaleString('en-US', { hour: 'numeric', … })` without a `timeZone` option. Server (Cloudflare Worker = UTC) and client (user's browser = local TZ) produced different time strings, causing React to throw #418 on the text node mismatch. Fix: added `timeZone: 'America/New_York'` to all four datetime `toLocaleString` calls in `RiverConditionsDetailDialog`; pinned number `.toLocaleString()` calls to `'en-US'` locale to prevent locale-default divergence on Cloudflare. | ✅ COMPLETE | `36f5166` |
| Security: postcss override | Next.js 15.5.18 pinned postcss to 8.4.31, below the GHSA-qx2v-qp2m-jg93 patch threshold (8.5.10). Forced postcss ^8.5.10 via pnpm-workspace.yaml `overrides` (pnpm 11 moved overrides out of package.json). Audit clean; tree de-duplicated to single postcss@8.5.15. Real-world XSS exposure was nil (build-time only on author-written CSS) but the override clears Dependabot. | ✅ COMPLETE | `7191087` |
| Navigation: preserve date+age on outbound location links | Pre-fix: `RiverLevelTile` (homepage cards) and `MetroSummaryPanel` best-bets links navigated to `/locations/<slug>` with no query params — clicking a forecast-date chip then a location card silently reset to today's view. Tile + best-bets hrefs now append `?date=&age=`. Also added `ConditionsForm` to the location detail page so users can change date/age without bouncing back to `/`. | ✅ COMPLETE | `887281a`, `fad109f` |
| Navigation: URL-encode age bucket in hrefs | `+` in the `14+` bucket decodes as a space in query strings, breaking `isValidAgeBucket` server-side. Three hrefs corrected via `encodeURIComponent(ageBucket)`. Discovered during sub-goal 63 route testing (regression-guard test surfaced the bug). | ✅ COMPLETE | `9f80250` |
| Dynamic content loading sub-goal 63 | New API routes `/api/metro-summary` and `/api/location-interpretation` — thin HTTP wrappers over `getMetroSummary` / `getLocationDetail`. Zod-validated params (date regex, age refine via `isValidAgeBucket`, slug regex), `isInWindow()` guard, 400/404/502/500 error contract, `Cache-Control: public, max-age=30, stale-while-revalidate=120` (tighter than plan default because cache keys are per-(date, age, slug)). nodejs runtime (consistent with crons, not edge). 22 new tests covering param validation, window rejection, happy path, AI failure, 404, 500. | ✅ COMPLETE | `05d27da` |
| Dynamic content loading sub-goal 64 | `<LazyContent>` client wrapper + `<Spinner>` + `<SkeletonShimmer>` primitives + `lazyFetch` pure helper. State machine: idle → loading (with optional prior data for stale-while-revalidate) → success → error (with retry button). aria-live="polite", aria-busy toggles, 500ms-delayed status text gate, AbortController on unmount + URL change, `motion-reduce:animate-none` honoured. Shimmer keyframes added to globals.css. 20 new tests (10 on lazyFetch helper, 10 on initial-render shape + a11y attrs via renderToStaticMarkup). | ✅ COMPLETE | `b94d68e` |
| Dynamic content loading sub-goal 65 | `MetroSummaryPanel` migrated from server component (`await getMetroSummary`) to client component using `<LazyContent>` pointing at `/api/metro-summary`. `<MetroSummaryContent>` extracted as pure render layer. `<Suspense>` boundary removed from `app/page.tsx`. Status text "Generating recommendations…" appears after 500ms. Speculation rules still emitted (browsers honour them when added dynamically post-fetch). MetroSummarySchema used as parse function. Bundle: `/` route 7.93 kB (376 kB First Load) — healthy. | ✅ COMPLETE | `50e51be` |
| Dynamic content loading sub-goal 66 | Location interpretation migrated via shared `<LocationInterpretationProvider>` context — single fetch of `/api/location-interpretation` exposed to four consumer components (summary, activity matrix, prep checklist, attribution). Preserves the existing page order (AI narrative → water quality → upstream CSO → activity matrix → prep checklist → attribution) without four parallel fetches or layout reorder. `getLocationDetail` accepts `{ skipInterpretation?: boolean }` — the page passes true to skip the server-side AI call; the API route does not (it explicitly wants the AI). `/locations/[slug]` route 3.11 kB (372 kB First Load). | ✅ COMPLETE | `c2e3672` |
| Dynamic content loading sub-goal 67 | Polish + a11y + Lighthouse verification + end-of-round deploy. Manual smoke confirmed four states render correctly. Deployed across multiple commits. Belle Isle Lighthouse final: 98/100/96/100 — within tolerance of pre-migration baseline (98/100/96/100 at sub-goal 79). Homepage final: ~88/100/96/100 — Accessibility recovered to 100 after the `opacity-75` removal in `f468040`; **Performance regressed from ~98 → ~88 due to FirstVisitModal becoming the LCP element under Lighthouse's mobile throttling**. Two perf fix attempts (`8fb4e6d` metro header hoist, `8946aa3` modal defer via requestIdleCallback) did not move the score — Chrome still picks the modal as LCP regardless of when it paints, because no deterministic element on the homepage is larger. **Tradeoff accepted 2026-05-31:** real users on real connections see ~500ms LCP (not the 3.4s Lighthouse reports under Slow 4G + 4× CPU throttle); the modal is a deliberate safety-messaging surface for first-time visitors. Iterating further would require interaction-gated modal (passive viewers miss safety notice) or server-side cookie-based gating (architectural complexity). Filed as a tracked tradeoff rather than a perf regression. CWV are technically within spec: CLS 0, TBT under 200 ms; LCP 3.4 s on simulated mobile is "needs improvement" range but acceptable given the modal's purpose. | ✅ COMPLETE (with documented Lighthouse tradeoff) | `8fb4e6d`, `8946aa3`, `f468040` |
| CSO false-alarm hotfix | Two bugs surfaced 2026-05-31 by user-reported discrepancy between rvajames.org ("Sewer overflow in progress") and EmNet live map (zero active events). (1) Sub-goal 94 auto-extend logic in `lib/ingest/cso.ts` selected "any open advisory for this outfall" when bumping, allowing a July 2025 advisory to be perpetually extended (11 months) every time the same outfall briefly transitioned to overflow=true. Fix: key lookup on `(source, source_id)` — source_id embeds `csoLastOccurrence`, so each event has its own lifecycle. (2) CsoBanner showed "Sewer overflow in progress" with confidence even when `current_overflow_observed_at` was 9+ hours stale. Fix: 2-hour staleness gate downgrades active → residual when data is older. (3) Follow-up: AdvisoriesBanner CSO row copy changed from "active" to "recent" to match honest-residual framing (`0527385`). Out-of-scope follow-up: 4 in-flight zombie advisories in prod need a one-time SQL UPDATE retiring them (code prevents future zombies but doesn't clean existing). | ✅ COMPLETE | `464f343`, `0527385` |
| Spec audit sub-goal A — HSTS header | `Strict-Transport-Security: max-age=31536000; includeSubDomains` added to `middleware.ts`. NO `preload` directive yet — HSTS preload list is irreversible (removal takes months); standard practice is monitor 30+ days first, then submit to hstspreload.org. Resolves the spec-check 🔴 HIGH finding. | ✅ COMPLETE | `424f525` |
| Spec audit sub-goal B — Graduate CSP to enforced | Renamed `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. Policy directives are byte-identical. Lighthouse inspector-issues showed zero actual blocked-resource sub-items during the Report-Only period (just the header's presence triggers the issue bucket), so the graduation is safe. `'unsafe-inline'` on script-src/style-src remains as the honest reflection of Next.js inline hydration — nonce-based tightening tracked as a separate follow-up. | ✅ COMPLETE | `9ed57fc` |
| Spec audit sub-goal C — /.well-known/security.txt | Added `public/.well-known/security.txt` per RFC 9116 pointing at GitHub private security advisories. Created the project's first `public/` directory; Next.js + OpenNext auto-bundles it. Expires 2027-05-31 (rotate before then). | ✅ COMPLETE | `99e0bce` |
| Spec audit sub-goal D — /llms.txt | Added `public/llms.txt` per llmstxt.org. Describes site purpose, data sources, AI scope, key endpoints, age-bucket enum, stable URL shapes, limitations. Closes the "/llms.txt" finding and the "Machine-readable formats" finding in one file. | ✅ COMPLETE | `2370813` |
| Spec audit sub-goal E — JSON-LD Organization + WebSite | Single `<script type="application/ld+json">` block in `app/layout.tsx` carrying an Organization + WebSite @graph (publisher/site relationship via @id). Inherited site-wide. Closes three findings at once: SEO structured data, agent structured data, machine-readable formats (overlap with /llms.txt). Per-page Place schemas for `/locations/[slug]` deferred to a future round. | ✅ COMPLETE | `21f7b71` |
| Spec audit sub-goal F — hreflang contradiction | Contradictions report flagged "13 hreflang entries in Screaming Frog export" against `localeScope=single` profile. Investigation: Screaming Frog's `hreflang_all.csv` has 13 rows BUT every row has `Occurrences=0` and empty HTML/HTTP/Sitemap hreflang fields. `grep -rn "hreflang"` on `app/` and `components/` returned zero matches. `curl https://rvajames.org/ \| grep -i hreflang` returned nothing. The audit tool conflated "13 URLs inspected for hreflang" with "13 hreflang entries." False positive in the spec-check tooling. Site is correctly single-locale; no action needed. | ✅ COMPLETE (false positive — no code change) | — |
| Richmond Conditions Section (sub-goals 86–91) | New at-a-glance "is today good at the river?" panel introduced above the river-specific gauge. Sub-goal 86: UV-index ingest from Open-Meteo (NWS doesn't publish it), apparent-temperature (Rothfusz NWS formula) and wet-bulb (Stull 2011) utilities + thresholds. Sub-goal 87: rules engine additions — `swimToday()`, `happinessIndex()`, `nextHoursOutlook()`, `headlineForRichmondConditions()` (rewritten after user feedback to kill directional language and add water+shade prompts on heat warnings). Sub-goal 88: `RichmondConditionsSection` + `SwimTodayTile` + `FeelsLikeTile` + `NextHoursTile` components, deterministic headline as LCP candidate, AI microcopy via LazyContent. Sub-goal 89: `richmond_microcopy` field on MetroSummary schema with PROMPT_VERSION b2 → b3 hash bump (migration 0015), Write schema relaxed to optional after live 502s revealed ~30% AI omission rate. Sub-goal 90: data resolver `lib/queries/richmond-conditions.ts`, homepage reorder (Richmond above RiverSegmentPanel), redundant chip strip removed. Sub-goal 91: A11y verification + Lighthouse round + bonus scope: (a) FirstVisitModal → FirstVisitBanner conversion across three iterations — inline at top → bottom of page → cookie-driven SSR at top, resolving the sub-goal 67 LCP tradeoff entirely; (b) HorizontalGauge meter `overflow-hidden` fix for clean pill clipping; (c) deep-research validation of the JRPS activity matrix (105 agents, 23 sources, full report in `docs/jrps-research-2026-06-02.md`); (d) migration 0016 — six new activity slugs (wade, rock-climbing, fishing, snorkeling, tubing, bird-watching), `min_age_override` column on `location_activities`, `published` boolean on `locations` (Mayo Island unpublished), validated activity matrix per location, threshold cleanup (removed unsourced 5.0/10.0 ft per-location closures, added global `pfdRequiredAboveGageFt` rule). **Lighthouse mobile final: 98/100/96/100 — Performance recovered from sub-goal 67's ~88 baseline. LCP 2.4 s (under "good" 2.5 s), CLS 0 (perfect), Speed Index 2.1 s, TBT 80 ms, FCP 1.1 s, TTFB 20 ms.** Sub-goal 67's documented FirstVisitModal LCP tradeoff is fully resolved. | ✅ COMPLETE | `321cb40`, `b0e11c0`, `772cf76`, `cd3542c`, `87177eb`, `7961e21`, `20b7403`, `1c19ef6`, `b5757a4`, `ce946c5`, `8adb170`, `4f25263`, `f52e11d`, `ca1a117`, `d43ff68`, `f69d453`, `ca52f45` |

---

## Remaining work — recommended execution order

```
ALL AUDIT FINDINGS RESOLVED (22/23 done; Finding 13 dark mode explicitly deferred).
DATE-RANGE-FORECAST PLAN COMPLETE (sub-goals 74–79 shipped 2026-05-26).

DONE   All sub-goals 49–62 complete (responsive, closure sources, Pipeline Trail)
DONE   Finding 10 — preconnect + CSP beacon domains (14e8a00)
DONE   water_temp_f — Cartersville upstream proxy (14e8a00)
DONE   Sub-goals 58–61 — multi-source closure registry + Pipeline Trail (8740502, 5a86bcd)
DONE   Supabase migration 0010 applied to production (Pipeline Trail row live)
DONE   Sub-goal 62 — Brown's Island construction closure entered via /admin/closures/new (2026-05-25)
DONE   Sub-goals 74–79 — date-range-forecast round (deployed 2026-05-26)
DONE   Advisory structural dedup — source_id column + UNIQUE index + upsert refactor (2950e4b, 929ce08)
DONE   React #418 hydration fix — three commits across three angles; root cause was Intl ICU divergence
       in RiverConditionsDetailDialog's forecast-peak weekday+hour formatter (final fix: 0ba07ce, see
       "FIXED" entry below for full diagnostic history)

IN PROGRESS   Sub-goals 80–85: CSO event ingestion via EmNet (Cloudflare Browser Rendering)
       See docs/cso-emnet-plan.md. Launch-blocking — CSO is the top family-safety signal
       and our scraper has been silently finding zero rows for weeks because the city
       moved authoritative CSO data to apps.emnet.net/richmond-pub-map-app.

       Sub-goal 80 (schema) ✅ COMPLETE — commit 38bdd79 created
       supabase/migrations/0013_cso_outfalls.sql with cso_outfalls catalog table +
       advisories.outfall_id FK + RLS + agent_reader grant. Phase B ✅ COMPLETE
       2026-05-28 — migration applied to production via Supabase Studio. Verified
       via `pnpm query:prod` that cso_outfalls (10 columns) and advisories.outfall_id
       (uuid nullable) are live.

       Operational prerequisites for sub-goal 82 ✅ COMPLETE 2026-05-28:
         - Cloudflare Workers Paid enabled on the rva-james account
         - Browser Rendering enabled in the Cloudflare dashboard

       Sub-goal 81 ✅ COMPLETE — commit 58c6b99 added @cloudflare/puppeteer@1.1.0
       (graduated from the 0.0.x range the plan expected; API unchanged) to
       `dependencies` (NOT devDependencies — the worker calls puppeteer.launch()
       at runtime), added the `browser: { binding: "BROWSER" }` block to
       wrangler.jsonc alongside the assets binding, and confirmed BROWSER: Fetcher
       appears in worker-configuration.d.ts (gitignored, regenerated via
       `pnpm wrangler types`). No deploy in 81; binding is declared but unused
       until 82 ships an ingest that calls it.

       Sub-goal 82 ✅ COMPLETE — commit 32139cc. lib/ingest/cso-emnet.ts
       implements fetchEmnetSites(browserBinding) with dual extraction strategy:
       network response interception (primary — captures the JSON API response
       the React app fetches on load before React processes it) + React fiber
       traversal fallback (BFS through the memoizedState chain to find siteList).
       lib/ingest/cso.ts internals replaced: now gets BROWSER binding via
       getCloudflareContext, calls fetchEmnetSites, upserts sites into
       cso_outfalls, upserts advisories (source='emnet_cso', source_id=
       '{emnet_id}:{occurrence}', outfall_id FK, location_ids=[]) for any
       mainstem site with cso_last_occurrence within 48h. next.config.mjs got
       serverExternalPackages:['@cloudflare/puppeteer'] so `next build` SSG
       doesn't try to execute the Workers-only module. 24 new unit tests on
       all 5 pure helper functions.

       Sub-goal 83 ✅ COMPLETE — commit aae9e69. lib/safety/upstream-cso.ts:
       getUpstreamCsoForLocation(locationLng, windowHours=48) queries
       advisories joined !inner to cso_outfalls, filtering kind='cso_overflow',
       source='emnet_cso', effective_from window, outfall.lng < locationLng,
       affects_james_mainstem=true; returns UpstreamCsoSignal {count,
       mostRecentAt, outfalls[]}. LocationSummary gains upstreamCso field;
       both getObservedTodayData + getForecastTodayData resolve it in
       Promise.all per location. combinedLocationStatus: swimming locations
       with upstreamCso.count > 0 escalate to 'caution' ("CSO upstream —
       bacterial levels likely elevated"); closures and danger conditions win.
       12 new tests (7 upstream-cso + 5 rules CSO override). 225/225 total.

       Sub-goals 84–85 (UI, AI) — sequenced next.

       Note (process): commit 38bdd79 landed via a parallel agent session while I was
       editing the plan doc, and I subsequently committed 8c1c1df claiming sub-goal 80
       was "staged and ready" — wrong; it was already shipped. This is the second time
       I missed an in-flight commit by not running `git log --oneline -20` before
       declaring something staged. CLAUDE.md already mandates this verification at
       session start; I need to also run it before any reconciliation status update.

       Note (process, 2026-05-30): a similar drift recurred during the CSO UX
       round. While the user ran sub-goal 95 in a parallel /goal session, I edited
       app/page.tsx via the Edit tool to apply the url-state fix #2 (`?? new Date()`
       substitution). My `git add app/page.tsx` then staged the entire file state —
       including the sub-goal 95 CsoBanner import + JSX lines that were already
       present from the parallel session. Result: commit ed8d36f (url-state fix #2)
       contains 2 extra lines referencing components/banners/CsoBanner.tsx, which
       didn't exist in that commit's tree. A clean checkout of ed8d36f would fail to
       build. The bleed self-resolves at HEAD because a6c0c0e (sub-goal 95) adds
       the missing file. Single-developer impact only; no remote push happened
       between the bleed and the resolution.

       Lesson: when editing a file via the Edit tool, run `git diff <file>` BEFORE
       `git add` to see the full current diff (not just the edit I made). If
       unexpected modifications appear, stash or stage selectively rather than
       blanket-staging the file.

QUEUED (after 80–85, ahead of dynamic-content)
       Sub-goals 93–97: CSO UX refinement
       See docs/cso-ux-refinement-plan.md. User feedback after CSO/EmNet deploy
       (Worker f421ce7d on 2026-05-29) called out five issues with the live UI:
       (1) per-outfall IDs aren't user-helpful — counts in context are;
       (2) active advisories belong as a top-of-homepage banner with plain
       language + a /safety#cso link;
       (3) forecast dates incorrectly show "active now" — should reflect whether
       the selected date falls within an advisory's 48h window;
       (4) the upstream-CSO location panel is great but the per-outfall list is
       noise; keep the count;
       (5) separate "active discharge now" from "past event under residual 48h
       advisory" in the homepage banner.

       Confirmed scope decisions: cadence stays twice-daily (cron limit
       saturated) — banner labels staleness honestly; age targeting is
       messaging-only (data doesn't support stratification from EmNet); learn-
       more lives at /safety#cso (internal copy we control).

       Sequencing decided 2026-05-29: insert AHEAD of dynamic-content-loading
       (63–67). Same surfaces (MetroSummaryPanel, AdvisoriesBanner) — doing
       dynamic-content first forces a re-touch.

       Schema migration (93) requires user-applied DDL to prod (agent denied).

COMPLETE — Sub-goals 63–67: dynamic content loading (closed 2026-05-31)
       See docs/dynamic-content-loading-plan.md. Premise: move AI content from
       Suspense streaming to client-side fetch via new /api/metro-summary and
       /api/location-interpretation routes, add a reusable LazyContent wrapper,
       give visible loading + retry affordances, enable stale-while-revalidate
       on filter changes.

       Sub-goals 63 → 66 ✅ COMPLETE (commits 05d27da, b94d68e, 50e51be, c2e3672).
       The browser `load` event no longer waits on Anthropic latency on either
       `/` or `/locations/[slug]`.

       Sub-goal 67 ⏳ IN PROGRESS — local code complete; awaiting user-side
       smoke (cold/warm cache, slow 3G, filter change, error → retry, reduced
       motion, keyboard tab to retry button) + `pnpm build:cf && pnpm deploy:cf`
       + Lighthouse mobile verification (must retain 100/100/100/100 on `/` and
       `/locations/belle-isle` per hard constraint) + post-deploy smoke + push.

       Round-internal decisions captured:
         - No dev showcase route — Vitest + manual DevTools throttling instead.
         - nodejs runtime (not edge) for the new API routes — consistent with crons.
         - Cache-Control: max-age=30, stale-while-revalidate=120 — tighter than
           plan default since cache keys are per-(date, age, [slug]).
         - Sub-goal 66 uses a React Context provider (not four parallel
           LazyContent boundaries) so page order is preserved with one fetch.

COMPLETE — Richmond Conditions Section (sub-goals 86–91, closed 2026-06-03)
       See the dedicated row above in the round-summary table for the full
       commit list and Lighthouse verification (Performance recovered to 98
       from sub-goal 67's documented ~88 tradeoff).

       The original sub-goal 91 scope (a11y verification, modern-web pass,
       Lighthouse verify, single deploy) expanded mid-round to cover three
       follow-on items surfaced by the verification run:
         - FirstVisitModal → FirstVisitBanner conversion across 3 iterations,
           ending with cookie-driven SSR at the top of <main>
         - HorizontalGauge meter clipping fix (overflow-hidden pill mask)
         - JRPS data validation via deep-research + migration 0016
           (validated activity matrix, threshold cleanup, Mayo Island
           unpublished pending Capital Region Land Conservancy timeline)

       Execution order originally locked: CSO/EmNet (80–85) → CSO UX
       refinement (93–97) → dynamic-content (63–67) → Richmond Conditions
       (86–91) → /about page. Now: only /about page remains in the queued
       work from the original plan; tile redesign + JRPS outreach + 14
       new locations are queued as FOLLOW-UPs below for future rounds.

COMPLETE — Spec-Website audit follow-up (closed 2026-05-31)
       See docs/spec-website-audit-plan.md. Source: spec-check run
       `2026-05-31T02-31-02-Z` against https://specification.website.
       All 6 sub-goals shipped in the same /goal session as the
       dynamic-content close-out:
         A. HSTS header (🔴 high)                       — `424f525`
         B. CSP graduate from Report-Only → enforced    — `9ed57fc`
         C. /.well-known/security.txt                   — `99e0bce`
         D. /llms.txt                                   — `2370813`
         E. JSON-LD Organization + WebSite schema       — `21f7b71`
         F. Hreflang contradiction                      — false positive
       The contradiction flagged "13 hreflang entries" but Screaming
       Frog's hreflang_all.csv showed all 13 rows with Occurrences=0
       (no actual hreflang anywhere). Tool conflated "URLs inspected"
       with "hreflang entries." Documented and closed without code change.
       Awaiting deploy (commits batched with the FirstVisitModal a11y fix
       `f468040`).

COMPLETE — /about page (closed 2026-06-04)
       Last queued static page from the original plan. Ships in three sections
       at app/about/page.tsx:
         - "What this is" — project intent + AI-disclosure posture (mirrors
           /safety + DisclaimerFooter)
         - "About the creator" — user-supplied bio, VERBATIM (kickoff Q&A
           2026-06-04). Five paragraphs + h3 subhead, no paraphrasing. Tests
           assert the exact strings so future edits can't silently rewrite.
         - "How it's built" — 2-paragraph plain-language overview + collapsible
           <details>/<summary> "For the technically curious" sidebar covering
           stack, ingestion crons, AI design (prompt caching + SHA-256 dedup
           hash), freshness model, safety posture. Cross-links to /safety and
           /status.

       User inputs resolved at kickoff (2026-06-04):
         1. Bio: user wrote it themselves, supplied verbatim
         2. Contact links: ONLY the public repo (https://github.com/MikeNGarrett/rvajames)
         3. Photo: none
         4. Navigation: BOTH — "Learn more →" link appended to the homepage
            tagline ("James River conditions for Richmond families. Learn more →")
            AND a footer link in DisclaimerFooter ("About RVA James")
         5. Repo: public, link surfaced in both the plain-language overview
            and the details sidebar

       Sitemap updated to include /about with monthly priority 0.5 (same tier
       as /safety). 17 new tests across app/about/page.test.tsx and
       components/legal/DisclaimerFooter.test.tsx. Full suite 543/543.

DEFER  Finding 13 — dark mode (own round if/when prioritized)

DEFER  AI pre-warm cron (Architectural — do NOT re-propose without revisiting the trade-off)
       Considered 2026-05-26 in response to user-reported chip-click slowness. Rejected
       in favor of the existing lazy-AI design. Rationale: pre-warming all (date, age,
       location) combinations daily would generate AI content that may never be viewed,
       defeating the original cost-discipline architecture that uses lazy on-demand
       generation + prompt_hash dedup. The user explicitly chose "bit of slowness over
       large monthly AI spend." Future agents: do not propose pre-warm without first
       confirming the user wants to reverse this trade-off. Slow-path mitigation paths
       that DO respect the design: (1) coarser prompt_hash bucketing (round gauge to
       0.1ft etc. so observed-mode cache hits more often), (2) OpenNext incremental
       cache adapter for HTML reuse when AI cache is already warm, (3) better skeleton
       UI / progress signal during cold AI gen, (4) Speculation Rules / next/link
       prefetch (mostly already in place).

DEFER  CDN edge-cache of HTML pages on Cloudflare Workers
       Investigation 2026-05-26 confirmed Cache Rules alone don't cache HTML from a
       Worker — Workers run before cache, and OpenNext's SSR path is excluded from
       Cloudflare's default HTML caching. Cache-Control header `public, s-maxage=60,
       stale-while-revalidate=300` was shipped anyway (commit c7b0a46) because it
       drives browser BFCache + Speculation Rules prefetch + would auto-activate if
       OpenNext incremental cache is wired later. Real fix paths: OpenNext incremental
       cache (KV/R2 backed, 2-4h effort) or explicit caches.default.put/match in worker
       (4-6h, risk to SPA navigation). Both deferred until traffic or UX pain warrants.

FIXED      React #418 hydration mismatch (final root cause confirmed 2026-05-26 via dev unminified diff)

           THREE commits, each addressing a real but DIFFERENT hydration risk:

             36f5166 — RiverConditionsDetailDialog: pinned timeZone:'America/New_York' on all
                       four toLocaleString() calls + locale to 'en-US' on numeric calls. Closed
                       one class of risk (UTC-server vs local-browser divergence) but was not
                       the trigger for the user-reported error.

             67a061d — Extracted Date.now()-dependent rendering in RiverSegmentPanel into two
                       client-only components (RelativeAgeText, ClientTrendArrow in
                       components/metro/RelativeTime.tsx) so server emits no time-relative
                       text and the values populate via useEffect after hydration. Closed
                       a second class of risk (render-time Date.now() drift between SSR and
                       hydration timestamps) but also was not the trigger.

             0ba07ce — REAL trigger: a single comma. formatToParts-style ICU divergence on
                       toLocaleString with `weekday:'short' + hour:'numeric'` (no day-numeric):
                         Cloudflare Workers ICU: "Fri, 8 AM"
                         Browser V8 ICU:         "Fri 8 AM"
                       Fix: formatWeekdayHour() helper that calls toLocaleString twice (one
                       for weekday, one for hour, both tz-pinned) and joins with explicit
                       ", ". Output is byte-identical across engines.

           Diagnostic key: dev mode against a sync:prod-to-local'd database shows the
           unminified hydration error with tree diff. Production's minified `#418` strips
           that context entirely. The other two attempts addressed real defects but missed
           the actual trigger because we couldn't see what was differing.

           Future-debugging notes:
             - `suppressHydrationWarning` does NOT reliably suppress hydration ERRORS in
               React 19 production builds. Only the dev warning. For Date.now()-style
               render-time non-determinism, use the client-only useEffect pattern.
             - Whenever toLocaleString uses a SUBSET of format options (weekday alone,
               hour alone, etc.), format each piece separately and concatenate explicitly.
               ICU separator rules vary between V8 builds.

FOLLOW-UP  Skip-to-content link missing (WCAG 2.4.1 Level A)
           No skip link anywhere in the codebase. Keyboard users must tab through header
           on every page. Level A — conformance-blocking for any formal a11y claim.
           Fix: one <a href="#main" class="sr-only focus:not-sr-only ..."> in app/layout.tsx
           + matching id="main" on <main> elements.

FIRST PASS COMPLETE — Codebase + dependency cleanup audit (2026-06-05)
           First-pass audit shipped as commit 1a5e46f. Full findings in
           docs/cleanup-audit-2026-06-05.md. Two surgical fixes landed:
           dropped two duplicate env helpers from lib/env.ts, pinned vite
           as an explicit devDep (silences UNRESOLVED_IMPORT warning).

           7 follow-up items queued for future rounds — each is independently
           shippable:

             1. (SMALL) Migrate lib/ingest/run.ts to use getCronSecret() from
                lib/env.ts instead of reading process.env.CRON_SECRET directly.
                Latent Workers-env bug: env bindings live in request context,
                not process.env. Works today via nodejs_compat polyfill but
                fragile.

             2. (SMALL) Investigate duplicate MetroSummaryReadSchema /
                MetroSummarySchema in lib/ai/prompts/summarize-metro.ts. Likely
                a legacy alias from a refactor. Confirm which name is consumed
                externally, drop the other.

             3. (SMALL) Add knip.json config with the vitest plugin + entry-point
                declarations. Current default-config knip run produces ~40 false
                positives because tests aren't entry points and same-file
                internal references are missed. Cleaner config = lower noise =
                future cleanup passes are 10× faster.

             4. (SMALL) Migrate vitest.config.ts from transformWithEsbuild
                (deprecated in vite@8+) to transformWithOxc. The current API
                works but emits a deprecation warning on every test run.

             5. (ROUND) Investigate DB-side cruft (unused columns, orphaned
                tables, stale advisory rows pre-dating source_id migration).
                Requires production query patterns + the read-only prod
                connection. Sized as its own round.

             6. (ROUND) Build-output review: run `pnpm build:cf` and inspect
                the worker.js bundle for warnings + size regressions. Best
                tied to a deploy + Lighthouse run.

             7. (ROUND) Tailwind / globals.css review — identify @theme tokens
                defined but never referenced; custom rules that Tailwind could
                provide natively. Requires a Tailwind-aware scanner.

           Original 7-category scope kept below for reference:

           Scope to cover:
             1. Unused / dead code
                - tsc-strict / ts-unused-exports / knip pass to find unused
                  exports, unreachable components, orphaned utility functions
                - Components imported in only one place that could inline
                - Old `_dev` routes still serving a purpose? (app/_dev/visuals)
                - components/states/Empty + Stale — still actively used?
                - Any leftover scaffolding from Goal 1-4 (brand showcase,
                  supabase-check) that's not referenced from production paths
             2. Unused database columns / tables
                - location_resources rows for active vs orphaned locations
                - conditions_snapshots payload shapes — any unread fields?
                - ai_interpretations.prep_items — still consumed by PrepChecklist?
                - Mayo Island (published=false) — still queryable as expected?
                - Old advisory rows that pre-date the source_id migration
             3. Stale config / docs
                - .env.local.example, .env.read-prod, .dev.vars.example —
                  in sync with what's actually read?
                - wrangler.jsonc — any defunct env bindings or cron triggers?
                - docs/ — which markdown files are still active references
                  vs historical context that could move to a /docs/archive/
                  subdirectory?
                - CLAUDE.md / AGENT_NOTES — accurate?
             4. package.json review
                - Dependencies vs devDependencies sorting (any dev-only deps
                  in dependencies that bloat the deploy?)
                - Pinned vs ^/~ versions — drift since last audit
                - Scripts that are no longer used (e.g. test:e2e if there
                  are no e2e tests, build steps from earlier stacks)
                - Any deprecated packages (Next.js / @opennextjs / supabase /
                  Anthropic SDK) with security advisories
                - depcheck or knip for unused deps
             5. Test suite hygiene
                - 549 tests today — any duplicates? Any that test mocked
                  behavior of the same shape repeatedly?
                - Flaky tests? (vitest --bail to find)
                - Coverage gaps for critical paths (rules engine, advisories,
                  AI dedup) vs cosmetic-only test surfaces
                - Snapshot tests — any stale snapshots not pruned?
                - Test fixtures co-located vs centralized — consistency?
             6. Build output review
                - `pnpm opennextjs-cloudflare build` — any warnings worth
                  resolving? Bundle size of the worker.js?
                - next.config.mjs experimental flags still needed?
             7. CSS / Tailwind cleanup
                - Tailwind v4 @theme block — any tokens defined but never
                  referenced?
                - globals.css custom rules — any that Tailwind could provide
                  natively?

           Methodology: read-only investigation first, batched findings,
           one-PR-per-category cleanup commits so risk is contained.
           Sized as its own round, not a single /goal session — likely 3-5
           commits spread across the categories above.

FOLLOW-UP  Tile redesign — location-state row + activity row + flavor row
           Design proposal captured in the 2026-06-02 thread; data layer
           shipped via migration 0016 + thresholds.json updates. Remaining
           work for the UX round:
             - Extract a unified <WaterQualityIcon> component (closes the
               water-quality-icon followup below)
             - Build <LocationStatusRow> (Open/Closed badge + WQ icon + CSO label)
             - Build <ActivityChipRow> (top-3 activities, sort by status worst-first)
             - Refactor RiverLevelTile to render three new rows + closure branch
             - Decide whether to render the "Coming soon" section (Mayo Island,
               future Pump House cove) or leave hidden until more candidates
               accumulate
             - Per-activity rules-engine verdicts for the 6 new slugs (today
               lib/safety/rules.ts has only `nonRiverwideActivityVerdict()`
               returning a generic 'check site before visiting' for all of them)
           Sized for a single /goal session once we have JRPS outreach answers.

PARTIALLY ANSWERED  JRPS direct-outreach research questions
           Original queue from 2026-06-02. Subsequent 2026-06-03 follow-up
           identified the USACE/NWS HEC-RAS-derived Flood Inundation Mapping
           ArcGIS Experience as a model-based source for per-location gauge
           thresholds (`docs/jrps-flood-inundation-thresholds-2026-06-03.md`).
           Status of the four open questions:

             1. Per-location Westham gauge thresholds.
                RESOLVED 2026-06-03 — six thresholds now in thresholds.json:
                  - Belle Isle south-channel rocks submerged: 20 ft (model,
                    HEC-RAS elev_118_8; Chrome UI confirmed at 22 ft Major)
                  - Brown's Island riverbank inundates: 11 ft (model, lowest
                    modeled stage)
                  - Potterfield Bridge deck overtops: 25 ft (model,
                    elev_123_8); activities.bridge_crossing.gage_deny_above_ft
                    bumped from 22 → 25
                  - Pony Pasture parking-lot entry: 16 ft (NOAA published)
                  - Pony Pasture overall access: 14 ft (user-provided
                    operational threshold, local knowledge; not extracted
                    from HEC-RAS — model probe missed due to coord precision
                    near a thin polygon edge, Chrome confirmed the polygon
                    does reach the area at high stages)
                  - Shiplock Trail walkway: 16 ft (user-provided operational
                    threshold; Shiplock sits outside the Westham FIM extent
                    so a fully model-derived value would require querying
                    the separate City Locks FIM and translating between
                    gauges)
                Wired into rules engine via locations.{slug}.flood_close_ft;
                tests/rules.test.ts asserts the danger escalation at the
                threshold value for each location.

             2. Has Potterfield Memorial Bridge ever closed?
                ANSWERED. User-confirmed 2026-06-03: Hurricane Florence
                (September 2018) is the ONE flood-cause closure since the
                bridge opened in December 2016. All other closures since
                opening have been scheduled maintenance. Per user recall,
                the Westham crest at Florence was ~13 ft.

                Wait — earlier I treated 17-25 ft as the bracket for
                Florence based on indirect evidence (bridge open at 16 ft
                in 2019, model says deck overtops at 25 ft). User's first-
                hand recall of ~13 ft is BELOW that bracket, which means
                the bridge closed at a stage where the deck was nowhere
                near overtopping. Operational closure during Florence was
                event-driven (debris, rapid rise, accompanying flood
                watch), not deck-submersion. The 16 ft 2019 event
                presumably didn't trigger the same operational call —
                different rate of rise + debris context.

                Implication for the dashboard: lowered
                `activities.bridge_crossing.gage_deny_above_ft` from 25 →
                13 to match the operational precedent. The 25 ft physical
                overtopping number is preserved as `gage_deck_overtop_ft`
                for documentation. Net effect: dashboard now warns of
                possible bridge closure at any stage at or above 13 ft
                Westham, with framing that conveys "closures have been
                observed at this level during severe events" rather than
                "always closed above this stage."

             3. Mayo Island public-access timeline post-CRLC 2022.
                ANSWERED via 2026-06-03 follow-up web research +
                user-confirmed source:
                  - Dec 2022: CRLC acquisition under contract
                  - Sep 2025: Governor Glenn Youngkin celebrated the
                    conservation of historic Mayo's Island
                    (capitalregionland.org/2025/09/governor-glenn-youngkin-
                    celebrates-conservation-of-historic-mayos-island/)
                  - Fall 2025: Demolition/site prep
                  - October 2026 (target): initial public opening
                Codebase action: Mayo Island remains unpublished
                (locations.published=false) until October 2026 opening
                confirms. Then re-publish with seed activities derived
                from the public park plan.

             4. JRPS-published age guidance.
                PARTIALLY ANSWERED (refined 2026-06-03 from earlier
                "confirmed absent" framing): JRPS does NOT publish a
                formal blanket minimum age for general park access, BUT
                the City of Richmond and JRPS DO enforce mandatory safety
                guidelines and varying age limits for specific river
                activities, facilities, and city-run programming.

                Examples likely in scope (need confirmation per item):
                  - Virginia law: PFDs required for children under 13 on
                    recreational vessels under 21 ft
                  - City pools / aquatic facilities have their own age
                    rules (separate from JRPS)
                  - City-run programming (camps, classes, organized
                    paddle trips) may set age minimums per program
                  - Bicycle Skills Area may have helmet/age guidance

                Codebase action: dashboard age defaults stay derived from
                USCG + AAP (conservative), framed as suggested minimums
                not JRPS rules. If we want to surface specific City of
                Richmond ordinances (e.g., the under-13 PFD requirement
                already captured in globalRules.pfdRequiredAboveGageFt
                indirectly), they'd live in a new globalRules.ageRules
                block. Queued as a follow-up rather than a blocker.

FOLLOW-UP  Chrome UI validation of FIM thresholds (queued 2026-06-03)
           The 2026-06-03 ArcGIS tile probe (see
           docs/jrps-flood-inundation-thresholds-2026-06-03.md) produced
           three high-confidence Westham gauge thresholds via raw tile
           pixel sampling. Visual validation is the necessary next step:

             1. Open the Richmond-Westham FIM Experience in Chrome
             2. Pan + zoom to each of the 4 locations
             3. Step the stage slider from 11 ft upward
             4. Record the stage at which each location's polygon edge
                crosses the feature
             5. Reconcile with the tile-probe values:
                  - Belle Isle south-channel rocks: probe says 20 ft
                  - Brown's Island riverbank: probe says ≤ 11 ft
                  - Potterfield Bridge midspan: probe says 25 ft
                  - Pony Pasture beach: probe unresolved → visually check
                    whether the polygon ever crosses it within 11–28 ft
                  - Shiplock Trail walkway: probe unresolved → same

           After validation, the `thresholds.json` update sketched in
           docs/jrps-flood-inundation-thresholds-2026-06-03.md (Belle Isle
           20 ft, Brown's 11 ft, Potterfield 25 ft, bridge_crossing
           gage_deny_above_ft 22 → 25) becomes safe to commit. Use the
           Chrome MCP tools (navigate, javascript_tool, screenshot) since
           the Experience Builder app exposes a stage slider via the UI.

RESEARCH COMPLETE — Validate + seed N additional adjacent locations (research 2026-06-04 / 2026-06-05)
           Originally queued as "14 additional locations." Three parallel
           research agents (Cluster A trails, Cluster B boat ramps, Cluster C
           sensitive sites) produced a full evidence-cited tracker at
           docs/locations-research-2026-06-04.md.

           Final scope after research + user Q&A (2026-06-04 / 2026-06-05):

           SEED (12 locations) — migration 0017_locations_2026_06_seed.sql:
             - Cluster A trails: canal-walk, manchester-floodwall-walk,
               virginia-capital-trail, dock-street-park, reedy-creek,
               the-wetlands
             - Cluster B ramps: tredegar-boat-ramp, ancarrows-landing,
               huguenot-flatwater
             - Cluster C sensitive: tredegar-rope-swing,
               manchester-climbing-wall, chapel-island

           DROPPED from this round:
             - 14th Street Takeout — expert whitewater EXIT, not a family
               destination. Skip entirely.
             - Riverside Meadows / Williams Island Dam Park — user chose
               not to publish a location card; instead document the dams
               on /safety. (No Williams Island Dam Park entity exists in
               JRPS or municipal records.)

           NEW ACTIVITY SLUG: kayak-flatwater (calm-water paddling, min_age 6
           with USCG PFD). Surfaces on Huguenot Flatwater and Chapel Island.
           kayak-rapids remains for whitewater.

           DAM HAZARDS → /safety (separate commit): Z-Dam, Williams Island
           Dam, Bosher's Dam each documented as low-head-dam drowning
           hazards. Citation set in the research doc.

           Tredegar Rope Swing posture: published with min_age 14, hazard
           banner naming 2009/2011/2026 incidents, automatic close at
           Westham gauge ≥ 5 ft. No new rope-swing slug — surfaced via
           flavor + warning copy with swim activity.

           Migration not yet committed at the time of this audit-doc update.
           See research doc for full per-location specs + cross-cluster
           defaults applied where the user didn't explicitly answer.

FOLLOW-UP  "Coming soon" UI section design (queued 2026-06-02)
           Migration 0016 added `locations.published BOOLEAN DEFAULT true` so
           Mayo Island can be excluded from the homepage grid without losing
           historical data. The current behavior is "unpublished = invisible."
           Future design decision: do we surface unpublished/future locations
           in a separate "Coming soon" section below the main grid? Initial
           candidates would be Mayo Island (post-CRLC future park) and the
           Pump House cove (when restoration funded). Defer until we have ≥2
           candidates AND a tile-redesign that has space for the secondary
           section.

RESOLVED   Water-quality icons on RiverLevelTile not visually distinct
           Original problem (2026-06-02 screenshot): WaterDropBadge in
           components/tiles/RiverLevelTile.tsx rendered at 10x14 px with a
           font-size-5 "!" glyph inside the caution drop — too small to
           read, safe vs caution indistinguishable on the tile grid.

           Fix shipped 2026-06-04: extracted a unified
           components/ui/WaterQualityIcon.tsx with:
             - 24x24 viewBox + size prop (default 16, used at 18 in both
               RiverLevelTile and RichmondConditionsSection)
             - Caution state adds a large centered "!" at fontSize 14
               (~60% of drop interior height) — legible at any
               render size from 16 px up
             - aria-label, title, and aria-hidden on the SVG carry full
               accessibility semantics
             - Optional showLabel prop renders the short text label
               ("Water OK" / "Water caution") inline next to the icon
               for contexts where a glyph-only indicator isn't enough
           Replaced the inline WaterDropBadge in RiverLevelTile AND the
           ad-hoc 💦 emoji in RichmondConditionsSection's stats strip
           with the new component, so both surfaces now use the same
           visual treatment. 14 new tests cover the safe/caution
           variants, size prop, showLabel, and SVG a11y attributes.

           Component is also positioned as a building block for the
           larger tile-redesign round (see "Tile redesign" follow-up
           below) — when the LocationStatusRow ships, it'll consume
           WaterQualityIcon at size 18 as part of its icon strip.
```

FOLLOW-UP  VDH Harmful Algal Bloom (HAB) advisories ingest (queued 2026-06-05)
           User request 2026-06-05. Source:
           https://www.vdh.virginia.gov/waterborne-hazards-control/algal-bloom-surveillance-map/

           VDH (Virginia Department of Health) publishes an HAB
           surveillance dashboard as an ArcGIS-hosted interactive map.
           No public REST API, JSON endpoint, or RSS feed documented on
           the landing page — but the dashboard is ArcGIS, which means
           the underlying FeatureServer is almost certainly queryable
           via REST (same pattern as the JRPS Flood Inundation Map work
           in docs/jrps-flood-inundation-thresholds-2026-06-03.md).

           Round scope (sized as its own /goal):
             1. Discover the ArcGIS service URL behind the dashboard
                (Chrome devtools network panel, or the public ArcGIS
                Experience Builder config JSON).
             2. Write a /api/cron/vdh-habs route + lib/ingest/vdh-habs.ts
                that queries the FeatureServer for advisories whose
                waterbody or county matches our geographic area.
             3. Decide schema: extend `advisories` with a new kind
                `'hab'` or `'water_quality'` (already exists).
                Likely `'hab'` for distinct UI affordance.
             4. Surface on the relevant location tiles + headline.

           Geographic scoping — user confirmed 2026-06-05 that
           upstream/downstream modeling is out of scope, INCLUDING
           tidal-downstream propagation for Ancarrow's Landing. Modeling
           HAB plumes across river segments is too much engineering
           overhead for one infrequently-visited location.

           Final filter: subscribe to VDH advisories where the
           waterbody field contains "James River" AND the county is
           one of {Richmond, Henrico, Chesterfield, Goochland}.
           Treat all our locations as a single segment. If a tidal
           advisory ever needs to flag Ancarrow's specifically,
           revisit then — but the default is "if VDH doesn't tag the
           Richmond area, we don't flag it."

           Implementation hints:
             - The VDH page itself doesn't link the FeatureServer URL,
               but `view source` on the dashboard frame should expose
               it (or the embedded `appid` parameter resolves to a
               public Experience config endpoint, like the JRPS FIM
               investigation surfaced).
             - Cron cadence: VDH updates as new sample results come in;
               daily at most, plus on-demand during bloom season
               (May–Oct). A `0 6 * * *` daily run is sufficient — HABs
               don't appear and clear within a day.
             - Freshness threshold: advisories are typically rescinded
               via VDH press release; if a bloom advisory has been in
               the dashboard for >30 days without an updated `status`
               column, flag as stale.
             - UI affordance: a new `<HABBadge>` in components/ui/ that
               sits alongside WaterQualityIcon + CsoBadge in
               LocationStatusRow. Distinct visual (red triangle? algae
               leaf?) since this is a categorically different hazard
               than bacterial water quality.

           Open questions for execution time:
             1. Should HAB advisories override the "Best day to head
                out" headline copy? An active HAB is a stronger signal
                than a normal water-quality caution.
             2. Does VDH issue advisories for tributaries (Appomattox,
                Chickahominy) that join the James in the Richmond reach?
                Lower priority — surface only if the discovery step shows
                they're easy to filter to our reach.

           Not blocking any current feature work — sized as its own
           round once the user wants to ingest it.

FOLLOW-UP  Major river-events alerts (queued 2026-06-05)
           User request 2026-06-05. Surface alerts for high-traffic
           events taking place on the river — events that have the
           potential to close or crowd the river at specific access
           points. Motivating example: a tall-ships event tied to the
           America 250 celebration ~mid-June 2026 that will dock /
           transit through downtown Richmond's stretch of the James.

           SCOPE PHILOSOPHY (user-set):
             Bar for inclusion is HIGH. Only events with concrete
             impact on a river access point — closures, restricted
             access, expected heavy crowding. Random concerts at
             Brown's Island that don't change river access don't
             qualify. The cost of a noisy "events" surface is people
             tuning out the genuine closures.

           ── V1 SCOPE (small round, sized for a single /goal) ──────

           1. Schema. New table:
                events (
                  id, slug, title, description,
                  start_at, end_at,                    -- single window
                  affects_location_ids[] uuid[],       -- which tiles light up
                  banner_severity enum('info','notice','warning'),
                  official_url text,
                  source enum('manual','...future...'),
                  created_at, updated_at
                )
              Distinct from `advisories` (health/safety) and
              `location_status` (closures), which both have different
              semantics. An event IS NOT a closure — the location may
              still be visit-able, just busy. If an event also closes
              the site, the admin should ALSO create a location_status
              closure for the same window.

           2. Admin UI. Reuse the pattern from /admin/closures —
              list, create, edit, expire. Required fields: title,
              start_at, end_at, affects_location_ids. Optional:
              description (markdown), official_url.

           3. Homepage banner. A new <EventsBanner> in
              components/banners/ that renders above the existing
              CsoBanner when any event has start_at ≤ now() + 7 days
              AND end_at ≥ now(). Shows event title, dates, link.
              Stacks if multiple — typical case is 0 or 1, occasional 2.

           4. Location detail banner. The same banner renders on
              /locations/[slug] when the slug is in
              affects_location_ids[]. Tile already has space below the
              title.

           5. Lead-time. Banners fire 7 days before start_at by
              default. Tunable via env if needed.

           ── V2 / DEFERRED — auto-discovery ────────────────────────

           User explicitly flagged the high bar: "I would only focus
           on high-traffic events that have the potential to
           close/crowd the river at particular locations, if we're
           building this out to generate these events automatically."

           If auto-discovery ships:
             - Scrape Venture Richmond events
               (https://venturerichmond.com/events/) and the city
               press-releases feed for events meeting thresholds:
                 * Mentions a river access point by name OR
                 * Multi-day OR
                 * Expected attendance > 5k (per press release)
             - Auto-discovered events should go into the events table
               with source='auto' AND state='draft' — admin reviews
               before they appear on the public site. Mirrors the
               existing closure-source draft pattern from
               /admin/closures.
             - This is genuinely hard: false-positives are
               immediately user-visible. Probably not worth doing
               until v1 has shipped and the manual UX is tuned.

           ── MOTIVATING EVENT (research notes) ─────────────────────

           Tall ships America 250: in the user's own words "in a week
           or so." If we want this on the dashboard for the actual
           event, v1 needs to land in time. Manual entry would take
           ~1 hour of admin work once the schema + UI exist.

           Execution-time discovery: identify the canonical event
           page (Venture Richmond, Richmond.com, City PR), grab the
           dates, location list, and crowd-expectation framing. Then
           the admin form is a one-shot entry.

           ── NOT in v1 ─────────────────────────────────────────────

           - Recurring events (weekly farmers market, etc.) — distract
             from the "this matters today" framing
           - Auto-discovery (see V2)
           - Event-driven AI interpretation regeneration — the AI
             system prompt would need an `active_events` block.
             Defer until v1 is shipped and there's signal that the
             interpretation copy is missing context users want.

           ── Open questions for execution ──────────────────────────

             1. Should events ever ALSO write a location_status closure
                row automatically? Probably not — the admin should
                consciously decide if a closure is warranted.
             2. Multi-window events (e.g. a 4-day festival with
                different active windows each day) — single start/end
                or windowed schedule? V1: single window. If the user
                hits a multi-window case, revisit.
             3. End-state behavior: when end_at passes, does the
                event silently disappear or get a "Last week:" pill?
                V1: silently disappear; the past isn't actionable.

           Not blocking any current feature work — sized as its own
           round. If user wants v1 for the tall ships event, it's the
           next slot.

FOLLOW-UP  Homepage LCP regression after tile-expansion deploy (2026-06-05, refreshed 2026-06-08)
           Post-deploy Lighthouse against https://rvajames.org/ after
           migrations 0016–0019 + tile-redesign + 12 new locations
           shipped. Initial single-run pass 2026-06-05 showed perf
           98 → 92. Refreshed with a 3-run median pass 2026-06-08 to
           characterize variance — the variance is the headline finding.

           THREE-RUN MEDIAN NUMBERS (2026-06-08)

             Homepage (https://rvajames.org/)
               Performance:    89   (median; runs 88 / 89 / 98)
               LCP:            3.68s (median; LCP scores 56 / 58 / 92)
               FCP:            1.33s (scores 98 / 99 / 98 — stable)
               TBT:            74ms  (99 / 99 / 100 — stable)
               CLS:            0     (perfect across all 3 runs)
               Speed Index:    1.86s (98 / 100 / 100)
               TTI:            3.73s (90 across all runs)
               Accessibility:  93    (stable)
               Best Practices: 96    (stable)
               SEO:            91    (stable)

             /locations/huguenot-flatwater (representative new detail page)
               Performance:    87   (median; 86 / 87 / 87 — tight)
               LCP:            3.61s (scores 59 / 61 / 61 — tight)
               Accessibility:  100   (perfect across all 3)
               FCP:            1.69s (92 / 92 / 90)
               TBT:            70ms  (excellent)
               CLS:            0     (perfect)

           THE BIMODAL-VARIANCE INSIGHT — CRITICAL TO MITIGATION CHOICE

             The homepage is bimodal across runs: median perf 89 with
             LCP ~3.7s, BUT one run in three hits **perf 98 with LCP
             score 92** — the prior baseline, achieved on the new code.

             The render path is identical across runs. What's different
             is the cold/warm state of:
               - Cloudflare Worker (first request after idle = cold)
               - Supabase round trip (KV cache vs DB)
               - Open AI client / Anthropic round trip

             This shifts the mitigation thinking significantly. If the
             bottleneck were purely in-render compute (more tiles =
             more SSR = slower LCP), variance would be tight and ALL
             runs would degrade together. They don't. The 98-perf run
             proves the new code CAN hit baseline. The 89-median says
             upstream data-fetch latency dominates LCP on cold paths.

             The detail page has lower variance (tight 86-87 perf)
             because each request is always a fresh Worker invocation
             from the user's perspective — it always pays the cold-
             path cost. The homepage benefits from intermittent warmth
             when traffic clusters.

           REVISED CANDIDATE MITIGATIONS (priorities flipped)

             HIGH-VALUE (likely to recover the bimodal):
               1. Cache-warming cron. Hit the homepage every N minutes
                  from a Cloudflare Cron Trigger to keep the Worker +
                  KV warm. Cheap to ship. Trades a small egress cost
                  for consistent LCP across user requests.
               2. Move heavy data fetch off the LCP path. getTodayData
                  does multiple parallel DB queries — if any of them
                  block the LCP element's render, splitting "above-the-
                  fold-render data" vs "below-the-fold data" would
                  let the LCP element ship sooner. Requires reading
                  the .lighthouseci/lhr-*.html report to identify the
                  actual LCP element first.
               3. Identify the LCP element explicitly. The prior
                  98-baseline LCP target was the "Conditions Summary"
                  block. Verify whether it's still the target on the
                  89-median runs vs has shifted to a tile in the new
                  grid. The fix depends on the answer.

             LOWER-VALUE (probably won't help much given the variance pattern):
               4. Lazy-render tiles below the fold. Would help if the
                  bottleneck were in-render DOM cost, but with cold-
                  path data-fetch dominating, this is secondary.
               5. Reduce per-tile SSR cost (memoize ActivityChipRow
                  sort, etc.). Same reason — render compute isn't
                  what's varying between runs.
               6. Slim script chunks / images. Same — would smooth
                  performance generally but not the cold-path variance.

           PRIORITY
             Soft. Page is fully usable; the variance means real users
             often hit a fine page and sometimes hit a slow one. CLS
             is 0 across all runs (the most-likely-to-frustrate metric
             stayed clean). Worth fixing before adding more upstream
             data-fetch surface (e.g. event ingest, HAB ingest) since
             each one extends the cold-path cost.

           SIZED AS
             One investigation pass (read .lighthouseci/ HTML report
             for an 89-run AND the 98-run, diff what's different) +
             one or two focused fixes. The cache-warming cron is the
             cheapest first move and would also exercise mitigation #2
             without code changes — if it shifts the median up
             meaningfully, the data-fetch path is confirmed as the
             cause.

           ARTIFACTS
             Local Lighthouse runs 2026-06-05 (single-run baseline)
             and 2026-06-08 (3-run median for variance) — files in
             .lighthouseci/ (gitignored). Re-run with:
               lhci collect --url=https://rvajames.org/ \
                 --url=https://rvajames.org/locations/huguenot-flatwater \
                 --numberOfRuns=3
             A future regression-check pass can compare medians
             directly.

```

---

## How this doc gets out of sync (and how to keep it honest)

This doc has gone stale twice. Pattern: the team executes in fresh `/goal` sessions that update plan files and write commits, but the reconciliation only updates when explicitly asked. To prevent further drift:

- **After any session that ships work, run a quick verification:**
  ```bash
  git log --oneline -20
  ls supabase/migrations/
  ls app/api/cron/ components/ui/ lib/ingest/
  ```
- **Cross-reference against this table.** Anything new in the codebase but not marked `✅ DONE` here is drift.
- **Patches:** when a finding ships, change `⏳` to `✅ DONE` plus the commit SHA. Single edit, 10 seconds.

A future agent reading this without doing the verification will reach the same wrong conclusions earlier versions did. The codebase is the source of truth; the plan files and this reconciliation are working notes that lag.

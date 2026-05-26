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
DONE   React #418 hydration fix — RiverConditionsDetailDialog timezone-naive toLocaleString (36f5166)

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

FIXED      React #418 hydration mismatch (root-caused 2026-05-26)
           Root cause: RiverConditionsDetailDialog (Client Component) used toLocaleString()
           without timeZone — Cloudflare UTC vs. browser local TZ produced different strings.
           Fix: timeZone: 'America/New_York' on all four datetime calls; 'en-US' pinned on
           number calls. RiverSegmentPanel.ageLabel() was already guarded by
           suppressHydrationWarning. Commit: 36f5166.

FOLLOW-UP  Skip-to-content link missing (WCAG 2.4.1 Level A)
           No skip link anywhere in the codebase. Keyboard users must tab through header
           on every page. Level A — conformance-blocking for any formal a11y claim.
           Fix: one <a href="#main" class="sr-only focus:not-sr-only ..."> in app/layout.tsx
           + matching id="main" on <main> elements.
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

# RVA James — Audit Reconciliation

Cross-references each finding from `modern-web-evaluation-findings.md` against the staged plans, with **actual current state verified against the git history and codebase**.

**Last reconciled: 2026-05-24** (complete — all 23 findings resolved; Finding 13 dark mode explicitly deferred; all other open items addressed). Earlier versions of this doc significantly understated what had shipped — the team had been executing in parallel sessions faster than the doc was being updated. This version is built from `git log` and direct codebase inspection.

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
| Sub-goal 62 | Manual admin entry — Brown's Island construction closure via /admin/closures/new (no code change needed) | ⏳ MANUAL STEP — No code change. Admin should create a location_status row: location=browns-island, kind=closed, affects='Entire island', reason='Closed for $30M improvement project. Reopens for Richmond Folk Festival October 9-11, 2026. Full completion early 2027.', source='Venture Richmond Brown\'s Island Improvement Plan', source_url='https://venturerichmond.com/browns-island-improvement-plan/', effective_from='2025-11-17', effective_to='2026-10-09', next_review_at='2026-09-01'. |
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
| Deferred | Finding 13 — dark mode | ⏳ DEFERRED |

---

## Remaining work — recommended execution order

```
ALL AUDIT FINDINGS RESOLVED (22/23 done; Finding 13 dark mode explicitly deferred).

DONE   All sub-goals 49–62 complete (responsive, closure sources, Pipeline Trail)
DONE   Finding 10 — preconnect + CSP beacon domains (14e8a00)
DONE   water_temp_f — Cartersville upstream proxy (14e8a00)
DONE   Sub-goals 58–61 — multi-source closure registry + Pipeline Trail (8740502, 5a86bcd)
DONE   Supabase migration 0010 applied to production (Pipeline Trail row live)

MANUAL Sub-goal 62 — Brown's Island construction closure via /admin/closures/new
              location=browns-island, kind=closed, affects='Entire island'
              reason='Closed for $30M improvement project. Reopens for Richmond Folk Festival
              October 9-11, 2026. Full completion early 2027.'
              source='Venture Richmond Brown's Island Improvement Plan'
              source_url='https://venturerichmond.com/browns-island-improvement-plan/'
              effective_from='2025-11-17', effective_to='2026-10-09', next_review_at='2026-09-01'

DEFER  Finding 13 — dark mode (own round if/when prioritized)
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

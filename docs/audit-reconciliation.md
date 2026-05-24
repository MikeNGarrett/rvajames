# RVA James — Audit Reconciliation

Cross-references each finding from `modern-web-evaluation-findings.md` against the four staged plans (Rounds 1–4) and identifies where each finding lands: already covered, fold-in, standalone, or defer.

Last updated: 2026-05-24, after the tidal data fix and pre-Round 3 execution.

---

## Findings already in flight or addressed elsewhere

| # | Severity | Finding | Status |
|---|---|---|---|
| 18 | low | `withIngestionRun` swallows INSERT errors | **✅ DONE.** Verified 2026-05-24 in `lib/ingest/run.ts` — explicit `// (Finding 18)` comment, try/catch wraps `fn()`, insert errors logged not swallowed. |
| 1 | high | LCP inside Suspense boundary inflates to ~9.5 s | **Implicitly enabled by Round 3 sub-goal 38** (deterministic hero becomes the largest visible element). Needs an explicit requirement added — see "Patches to staged plans" below. |
| 5 / 11 | high / medium | Location card aria-label mismatch (WCAG 2.5.3) | **Folds into Round 2 sub-goal 34** (RiverLevelTile simplification) if that hasn't run, or **Round 3 sub-goal 38** which restructures cards. Needs explicit requirement added. |
| 19 | low | Flat heading hierarchy (all `<h2>`) | **Folds into Round 3 sub-goal 38** — the panel restructure changes heading levels anyway. |
| 21 | nit | Speculation rules are CDN-default, not targeted | **Folds into Round 3 sub-goal 38** — `best_bets_today` is the natural input for app-controlled speculation rules. |

## Findings that warrant a dedicated mini-round

Grouped by theme so each round is shippable in one execution window.

### Round 5 — Quick wins (5–7 small fixes, total ~4–6h)

Severity-weighted, each <4h:

| # | Severity | Finding | Effort |
|---|---|---|---|
| 3 | high | `metadataBase` set to workers.dev, not rvajames.org | <1h |
| 4 | high | `text-text-muted` fails AA; `/60` opacity fails badly | 1–4h |
| 9 | medium | favicon.ico returns 404 | <1h |
| 22 | nit | `color-mix()` not used for subtle variants | <1h |
| 23 | nit | Container queries not used for activity grid | <1h |
| OOS | — | `prefers-reduced-motion` not honored in spinner/skeleton | <1h |
| OOS | — | `/brand` returns 404 in production (verify intent) | <1h investigation |

This round can run **before Round 3** — it's low-risk, fast, and clears noise from the audit baseline so post-Round-3 measurements are comparable.

### Round 6 — Headers, caching, BF-Cache (3 findings, ~6–10h total)

Worth bundling because they all touch the Cloudflare Worker response layer and share verification:

| # | Severity | Finding | Effort |
|---|---|---|---|
| 6 | medium | `cache-control: no-store` disables BF-Cache | 1–4h |
| 7 | medium | Static assets missing `immutable` directive | 1–4h |
| 8 | medium | Missing security headers (XFO, XCTO, Referrer-Policy, Permissions-Policy) | 1–4h |
| 17 | low | No CSP — start with Report-Only | 1–4h |
| 10 | medium | Cloudflare beacon: add `preconnect` (cheap version) | <1h |

Run **after Round 3**. Round 3's deterministic-hero changes are unlikely to interact with headers/caching, but it's better to do this once the perf baseline is what we expect long-term.

### Round 7 — Filter UX modernization (2 findings, ~6–8h)

| # | Severity | Finding | Effort |
|---|---|---|---|
| 15 | low | `ConditionsForm` uses `router.push` instead of `nuqs` setters | 1–4h |
| 16 | low | View Transitions not used for date/age filter navigation | 4h–1d |

These pair naturally — both touch `ConditionsForm`. Visual polish + perf. **Lower priority**; can wait until Round 6 or later.

### Round 8 — Bigger items, deferable

| # | Severity | Finding | Effort | Recommendation |
|---|---|---|---|---|
| 2 | high | CLS skeleton ≠ panel height | 1–4h | **Promote: do alongside Round 5 quick wins.** It's a "high" severity that's actually small. |
| 12 | low | Legacy JS polyfills (~11 KB) | 1–4h | Bundle into Round 8 modernization |
| 14 | low | Nunito Sans `display: swap` FOUT/CLS risk | 1–4h | Bundle into Round 8 modernization |
| 20 | low | No OG image defined | 4h–1d | Run after Finding 3 (Round 5) lands |
| 13 | low | No dark mode support | >1d | **Defer**. Nice-to-have. Own round if/when prioritized. |

---

## Out-of-scope notes — disposition

| Item | Disposition |
|---|---|
| `/brand` returns 404 in production | Round 5 (verify gating from Feedback Round 1 sub-goal 20) |
| `water_temp_f` null for both gauges | New mini-investigation — likely a USGS API parameter request issue (00010 not always returned for 02037705) |
| `ingestion_runs` stuck rows (finished_at null) | Cleanup after Finding 18 lands — UPDATE stuck rows to `ok=false, finished_at=now()` |
| `ConditionsForm` button aria-label | Folds into Round 7 (ConditionsForm modernization) |
| `prefers-reduced-motion` not handled | Round 5 quick wins |
| `/locations/[slug]/opengraph-image` URL origin | Folds with Finding 3 + Finding 20 |
| Cloudflare beacon self-injection vs. disable | Round 6 (preconnect as quick win; full self-host or disable is later) |

---

## Patches to staged plans

Three additions to capture in the existing plan files. I'll patch each on request — listed here for visibility:

### Round 3 (`docs/river-conditions-redesign-plan.md`)

**Sub-goal 38 (RiverSegmentPanel redesign)** — add to deliverables:
- *"The deterministic hero (headline rating + big gage value) must be sized to be the dominant visible element in the viewport at 375px, so it becomes the LCP element. The Suspense-bounded `MetroSummaryPanel` must NOT contain the LCP. Verify with Lighthouse mobile — LCP element should be in `RiverSegmentPanel`, not inside any `<Suspense>` boundary."* — Addresses Finding 1.
- *"Location card heading levels demote from `<h2>` to `<h3>`; wrap the location grid in a `<section aria-labelledby="locations-heading"><h2 id='locations-heading'>Locations</h2>…`. Aria-labels on tile links must contain all visible text (badge text + location name + reason), not the hidden rules-engine label."* — Addresses Findings 5, 11, 19.
- *"In `MetroSummaryPanel` (or its Suspense-resolved content), emit a `<script type='speculationrules'>` targeting `best_bets_today` slugs with `eagerness: 'moderate'`. Falls back gracefully if browser does not support speculation rules."* — Addresses Finding 21.

**Sub-goal 40 (verification)** — add to success criteria:
- *"Lighthouse LCP element is inside `RiverSegmentPanel`, not the metro summary."*
- *"CLS < 0.05 on stream-in of the metro summary (no shift)."* — covers Finding 2 if Round 5 doesn't address it first.

### Round 4 (`docs/closures-and-forecast-plan.md`)

No patches needed — Round 4 already covers its scope without finding overlap.

### Round 2 (`docs/homepage-rapids-redesign-plan.md`)

Mostly already executed (rapids badge is in production). **Sub-goal 34 (RiverLevelTile simplification)** — if it hasn't been executed, fold Finding 5/11's aria-label fix into its scope. If it has been executed, the aria-label fix happens in Round 3 sub-goal 38 (the location card touch is unavoidable there).

---

## Recommended execution order

```
DONE                Finding 18 — withIngestionRun fix (commit 852428e or 84f42cd)
DONE                Round 2 — Homepage rapids redesign (commit 84f42cd)
DONE                Round 4 sub-goal 41 — howsthejamesrva investigation (commit 926c1da)
NEXT   (Round 5)    Quick wins: Findings 2, 3, 4, 9, 22, 23, OOS-prefers-reduced-motion, OOS-/brand, + Item 9 (delete orphaned TopRecommendationsTile)
THEN   (Round 9.48) Responsive foundation + design contract — sub-goal 48 only (page container scale, reading-width tokens, text-wrap polish, docs/responsive-guidelines.md). Runs BEFORE Round 3 so Round 3's new components inherit the responsive contract.
THEN   (Round 3)    River conditions redesign (with patches above; migration renumbered to 0008; new components must follow responsive-guidelines.md) — sub-goals 35–40
THEN   (Round 9.49–52) Responsive application — sub-goals 49–52 apply the foundation to the full surface (per-route, per-component, container queries, visual regression sweep)
THEN   (Round 6)    Headers, caching, BF-Cache, security: Findings 6, 7, 8, 10 (preconnect), 17
THEN   (Round 4)    Closures + NOAA forecast (migration renumbered to 0009) — sub-goals 42–47
LATER  (Round 7)    ConditionsForm modernization: Findings 15, 16
LATER  (Round 8)    Polish: Findings 12, 14, 20
DEFER  (own round)  Finding 13 (dark mode)
```

This sequencing puts the highest-leverage cleanup work first (Round 5 quick wins), captures the LCP fix in Round 3 where it naturally lands, hardens the perimeter (Round 6) before the bigger Round 4 admin/auth surface, and leaves polish/modernization for later. Each step is shippable in one execution window.

---

## What this saves us

Without this reconciliation, the next agent would likely:
- Solve Finding 1 ad-hoc rather than as part of Round 3 sub-goal 38, missing the opportunity to design for LCP from the start.
- Treat Findings 6, 7, 8 as separate tickets rather than one Worker-response-layer pass.
- Run Round 4's admin UI work before Round 6's security headers, which is the wrong order (admin routes deserve harder headers than public routes).
- Re-solve Findings 5/11/19 in three separate touches instead of one.

# Cleanup audit — first pass 2026-06-05

User-requested cleanup pass. Read-only investigation with surgical fixes for
the most-confident findings. Larger refactors deferred to subsequent rounds
so risk stays bounded per commit.

**Methodology:** ran `knip` (default config) and `depcheck` (default config),
then cross-checked every finding by grep before classifying. Most knip
"unused export" hits are false positives — knip without a vitest plugin
doesn't pick up `.test.ts` files as entry points, and it appears to miss
some same-file internal references too. Treating any knip finding as
deletable without verification would have removed working code.

## Category-by-category findings

### 1. Unused / dead code

**Confirmed dead (delivered in the same commit as this doc):**

| Symbol | Location | Why dead |
|---|---|---|
| `getNextPublicSupabaseUrl()` | `lib/env.ts` | Duplicate. `getSupabaseUrl()` already falls back to `NEXT_PUBLIC_SUPABASE_URL`. Never called externally. |
| `getNextPublicSupabaseAnonKey()` | `lib/env.ts` | Same — `getSupabaseAnonKey()` already covers the NEXT_PUBLIC fallback. |

**Latent bug worth flagging (not fixed in this pass):**

`lib/ingest/run.ts:51` reads `process.env.CRON_SECRET` directly:

```ts
const secret = process.env.CRON_SECRET;
if (!secret) return new Response('CRON_SECRET not configured', { status: 500 });
```

…but `lib/env.ts:73` defines a `getCronSecret()` helper that uses the
`getCloudflareContext()` pattern every other env var uses. On Cloudflare
Workers the env bindings live in the request context, not `process.env`
(unless nodejs_compat populates them — undocumented behavior).

Two reasonable resolutions:

1. **Migrate `lib/ingest/run.ts` to use `getCronSecret()`.** Consistent with
   every other env access. Removes the latent risk of `process.env.CRON_SECRET`
   returning `undefined` on Workers under future runtime changes.
2. **Delete `getCronSecret()` and document that cron secrets are read via
   `process.env` by convention.** Less consistent but matches the current
   working code.

Option 1 is the cleaner fix. Surfaced as a separate todo because it's a
behavior-touching change and warrants its own commit + verification, not
a deletion-bundled change.

**False positives knip flagged (all kept):**

| knip claim | Reality | Fix for the audit tool |
|---|---|---|
| 24 test files "unused" | They ARE entry points — vitest runs them | Add knip vitest plugin config |
| `ActivityChip` type | Used as `activities: ActivityChip[]` prop type | Type erasure — knip parser miss |
| `Sparkline` | Heavily used across 6+ files | knip confused by the re-export in RichmondConditionsSection.tsx |
| `MetroSummaryPanelSkeleton` | Used in same file at line 109 | Same-file internal reference |
| `getAdminEmail` | Used by `requireAdminEmail()` in same file | Same-file internal reference |
| `computeLocationHashForTest`, `computeMetroHashForTest` | Used by `summarize-metro.test.ts` | Tests not in entry-point set |
| `ActivityStatusSchema` | Used internally in interpret-location.ts | Same-file internal reference |
| `FRESHNESS_MAX_AGE` | Used in same file at line 10 | Same-file internal reference |
| `scrapePage` (×3) | Used by each module's `.test.ts` | Tests not in entry-point set |
| All `cso-emnet.ts` exports | Used internally in same file | Same-file internal reference |
| `classifyReading` | Used in test | Test entry-point gap |
| `getLocationStatus`, `getNormalRange` | Used internally in same files | Same-file internal reference |
| `buildAdvisoryDateFilter` | Used internally line 243 + test | Same-file internal reference |
| `gageHeightStatus`, `postRainSwimStatus`, `bacterialStatus`, `waterTempStatus` | Used by `combinedLocationStatus()` lines 398/440/448 | Same-file internal reference |
| `formatDateParam` | Used in test | Test entry-point gap |
| `open-next.config.ts`, `lib/supabase/browser.ts`, `lib/logger.ts`, scripts/* | Used by CLI / framework / runtime | Knip entry-point gap |

**Recommendation:** add `knip.json` with a vitest plugin + entry-point
declarations before the next cleanup round. Without it the noise-to-signal
ratio makes future passes much slower than they need to be.

**Exported types flagged unused (16):** all preserved. These describe
public API surface — `DeterministicStatus`, `WaterQualityBadge`,
`MetroSummary`, `GaugeReading`, etc. — and removing them would require
inlining at each call site or losing documentation value. Type-level
deadness is rarely worth surgical removal without a forcing function.

**Duplicate export:** `lib/ai/prompts/summarize-metro.ts` exports
`MetroSummaryReadSchema` and `MetroSummarySchema` for the same schema.
One is likely a legacy alias from a refactor. **Recommendation:** verify
which name is consumed externally, drop the other, no action in this
round.

### 2. Unused database columns / tables

Not investigated in this pass. Requires production query patterns + read
of the analytics view (if any). Deferred to a future round with proper
DB introspection tooling.

### 3. Stale config / docs

Not investigated systematically. `docs/` was last cleaned 2026-06-04;
research docs from prior rounds (jrps-research-2026-06-02.md,
jrps-flood-inundation-thresholds-2026-06-03.md, etc.) are still active
references and shouldn't move to archive yet. `audit-reconciliation.md`
itself is the canonical roadmap and gets maintained inline. Deferred.

### 4. package.json review

**depcheck "missing" finding (real — fixed in the same commit as this doc):**

- `vite` is imported in `vitest.config.ts` (`transformWithEsbuild`) but not
  declared in `package.json`. It works today because vitest pulls vite in
  as a transitive dep (vite@8.0.14), but `pnpm vitest run` consistently
  warns `[UNRESOLVED_IMPORT] Could not resolve 'vite'`. Adding it as a
  devDependency makes the import explicit and silences the warning.

**depcheck "unused" findings (all false positives, kept):**

| Package | Why depcheck missed it |
|---|---|
| `eslint`, `eslint-config-next` | Used by `pnpm lint` via the `next lint` CLI |
| `typescript` | Used as the transpiler for every .ts file |
| `tsx` | Used to run `pnpm tsx scripts/ai-smoketest.ts` (and the planned `usgs-test.ts`) |
| `@tailwindcss/postcss`, `tailwindcss` | Used by `postcss.config.mjs` + globals.css directives |

**Script audit:** all 12 scripts in `package.json` are exercised. No
deletions in this pass.

### 5. Test suite hygiene

549 tests today, all green, ~10.5s wall time. No flakes observed across
the multi-day session. Coverage is not measured automatically. Findings:

- The `transformWithEsbuild` deprecation warning surfaces on every
  vitest run — the API itself works in vite@8.0.14 but is scheduled for
  removal. Migrating `vitest.config.ts` to `transformWithOxc` is the
  documented replacement path. **Recommendation:** open a small followup
  to swap the API; deferred to a future round.
- No snapshot tests anywhere (search for `.toMatchSnapshot` returned 0
  hits). Nothing to prune.
- Test fixtures are co-located with their tests (no centralized fixtures
  directory). Consistent with how the codebase grew; no churn warranted.

### 6. Build output review

Not run in this pass — would require `pnpm build:cf` which spends real
build time and emits worker.js bundle stats. Deferred to a future round
or until a deploy-tied audit makes sense.

### 7. Tailwind cleanup

Not investigated. Tailwind v4's `@theme` block in `app/globals.css` defines
project tokens; usage-tracing requires a Tailwind-aware scanner (knip
doesn't see CSS). Deferred.

## Summary

**Action shipped in this round (the commit that lands this doc):**

1. Delete two confirmed-dead env helpers (`getNextPublicSupabaseUrl`,
   `getNextPublicSupabaseAnonKey`).
2. Pin `vite` as a devDependency to fix the `pnpm vitest run`
   UNRESOLVED_IMPORT warning.

**Carried as follow-ups for subsequent rounds:**

1. Migrate `lib/ingest/run.ts` to use `getCronSecret()` instead of
   reading `process.env.CRON_SECRET` directly.
2. Investigate duplicate `MetroSummaryReadSchema` / `MetroSummarySchema`
   alias in `lib/ai/prompts/summarize-metro.ts`.
3. Add `knip.json` with vitest plugin + entry-point config so future
   passes have lower noise.
4. Migrate `vitest.config.ts` to `transformWithOxc` (vite@8+ deprecation).
5. Investigate DB-side cruft (category 2) with a proper introspection
   pass.
6. Build-output review (category 6) — tie to next deploy + Lighthouse
   round.
7. Tailwind token + globals.css review (category 7).

Each is independently shippable as a small commit. The bigger ones (DB
introspection, build output) should be their own rounds.

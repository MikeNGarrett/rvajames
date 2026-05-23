# RVA James — Deploy Hardening Plan

## Context

The 18-goal initial build (see `~/.claude/plans/i-want-your-help-curried-eagle.md`) is complete. The app runs locally against local Supabase + `pnpm preview`. This plan covers the gap between that state and a live preview URL on Cloudflare Workers with real data flowing on a real schedule.

Work splits into four sub-goals. **Execute 19 → 20 → 21 in order.** Sub-goal 22 is wall-clock-gated and is a checklist for the user to run 24h after 21 completes, not an agentic loop.

## Known state going in

- 18 goals built, all verified locally.
- RLS is disabled on all Supabase tables (local dev default).
- No hosted Supabase project linked.
- No Cloudflare account configured for this repo; no secrets set.
- `/supabase-check` and `/brand` routes shipped — may need cleanup.
- Cron Triggers declared in `wrangler.jsonc` but never exercised against a real schedule.

## North star

A live `*.workers.dev` preview URL where:
- All 4 ingestion jobs (USGS / NWS / JRA / CSO) and the AI interpret job run on their cron schedules.
- Hosted Supabase enforces anon-read-only via RLS; writes only via the service role from cron routes.
- `/`, `/locations/[slug]`, `/safety`, `/status` all render real data for any of the 9 locations × 5 age buckets.
- `/status` shows green for every source within one cron cycle.
- AI cost discipline holds: ≤ 45 interpretations/day, prompt cache reads observable.

## Sub-goal 19 — RLS policies migration

**Why:** Without RLS, anon clients can read/write any table via PostgREST once we ship to hosted Supabase. Our app data is public-read, but no-policy + hosted = production hole.

**Deliverables**
- `supabase/migrations/0002_rls.sql`:
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for: `locations`, `activities`, `location_activities`, `conditions_snapshots`, `advisories`, `ai_interpretations`, `ingestion_runs`.
  - `CREATE POLICY "anon_read" ON ... FOR SELECT TO anon USING (true)` per table.
  - No insert/update/delete policies for anon — those rely on service-role bypass via cron routes.

**Success**
- `supabase db reset` applies cleanly.
- With the anon key, `select` works on every table.
- With the anon key, `insert` fails with `new row violates row-level security policy` on every table.
- With the service role key, `insert` still succeeds.
- `lib/supabase/types.ts` regenerated cleanly.
- Sanity: `psql ... -c "select tablename, rowsecurity from pg_tables where schemaname='public'"` returns `t` for every row.

## Sub-goal 20 — Pre-deploy cleanup pass

**Why:** Dev-only routes and helpers should not run in prod; the production cron + secrets surface must be auditable.

**Deliverables**
- Delete `app/supabase-check/` if still present (Goal 2 flagged it for removal in Goal 11). Confirm with `grep -r supabase-check`.
- Gate `/brand` behind `if (process.env.NODE_ENV === 'production') notFound()` at the top of `app/brand/page.tsx`. Keep route available in dev.
- Verify `initOpenNextCloudflareForDev()` in `next.config.mjs` is dev-only (`process.env.NODE_ENV !== 'production'`, or current OpenNext-idiomatic guard).
- Audit `.env.local.example` and `.dev.vars.example`: every var read by `lib/env.ts` must be listed. Add any missing.
- Audit `wrangler.jsonc` `triggers.crons` — must include every cron route:
  - USGS `*/15 * * * *`
  - NWS `0 * * * *`
  - JRA `0 12 * * *`
  - CSO `0 6,18 * * *`
  - Interpret `15 6 * * *`
- Add `SECURITY.md` at repo root documenting: RLS posture, secret list and rotation, `CRON_SECRET` purpose, AI cost ceiling, who to contact for issues.

**Success**
- `pnpm build:cf` succeeds.
- `pnpm preview` boots; `/supabase-check` → 404; `/brand` → 404 in a prod build, 200 in dev.
- Every env var in `lib/env.ts` is present in both example files (grep diff = 0).
- Every cron route file has a matching entry in `wrangler.jsonc` (grep diff = 0).
- `SECURITY.md` exists with the sections above.

## Sub-goal 21 — First Cloudflare preview deploy

**Why:** Cron Triggers, real secrets, real data flow — none of this is verifiable on `wrangler dev`.

**User pre-requisites — DO NOT START THIS SUB-GOAL UNTIL CONFIRMED**
- [ ] Hosted Supabase project created. Capture: project ref, anon key, service role key.
- [ ] Cloudflare account ready; `wrangler login` complete (`wrangler whoami` confirms).
- [ ] Confirm Cron Triggers tier (verify per current Cloudflare docs whether our cadence requires the paid plan).

The agent **must stop and ask the user** for the Supabase project ref + Cloudflare-readiness confirmation before proceeding.

**Deliverables**
- `supabase link --project-ref <ref>` against hosted.
- `supabase db push` applies 0001 + 0002 to hosted.
- `supabase gen types typescript --linked > lib/supabase/types.ts` against hosted; commit the diff.
- Secrets via `wrangler secret put`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `CRON_SECRET`
- Public vars in `wrangler.jsonc` `vars` block (build-time accessible):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `pnpm deploy:cf` → preview URL captured.
- Manually trigger every cron endpoint with the production `CRON_SECRET` against the deployed URL: USGS, NWS, JRA, CSO, interpret. Each must return 200 and write rows to hosted Supabase.
- Visit `/`, every `/locations/[slug]`, `/safety`, `/status` on the deployed URL. All 200, rendering real data.
- `DEPLOYMENT.md` at repo root capturing: deploy URL, deploy timestamp, secrets list (names only, not values), last-run-per-source timestamps.

**Success**
- Hosted Supabase has populated rows in `conditions_snapshots`, `advisories`, `ingestion_runs`, and `ai_interpretations`.
- `/status` on the live URL shows most recent ingestion per source within its freshness window.
- AI smoketest against deployed env shows `cache_read_input_tokens > 0` on second call.
- Lighthouse mobile against `/` on the live URL meets the production budget (LCP < 2.5s — web.dev "good" threshold; CLS < 0.05). Run against the live URL, not the local build. The original Goal 18 used a 2.0s target which proved arbitrarily tight; 2.5s is the published industry standard.

## Sub-goal 22 — Cron cycle verification (user checklist, not agent loop)

**Why:** Cron Triggers fire on Cloudflare's clock. Verifying they fire correctly is wall-clock-gated.

**Process** (user runs 24h after sub-goal 21 completes)

Query hosted Supabase:
```sql
select source,
       count(*),
       max(finished_at) as last_run,
       sum(case when ok then 0 else 1 end) as failures
  from ingestion_runs
 where started_at > now() - interval '24 hours'
 group by source;
```

Expected row counts over 24h:
- USGS ≥ 90 (every 15 min)
- NWS ≥ 22 (hourly)
- JRA ≥ 1 (daily)
- CSO ≥ 2 (twice daily)
- Interpret ≥ 1 (daily)

Then:
```sql
select count(*) from ai_interpretations where date = current_date;  -- expect 45
```

If any source is short or failing:
- Inspect `ingestion_runs.error` for the offending source.
- `wrangler tail` against the deployed Worker to see live logs.
- `wrangler deployments list` to confirm the cron strings deployed match `wrangler.jsonc`.

## Execution rules for the agent

- Execute 19 → 20 → 21 in order. Do not start 21 until the user confirms the manual pre-requisites.
- After 19 and 20 land, **stop and report** before starting 21. Ask the user for:
  - Supabase project ref.
  - Cloudflare-readiness confirmation.
- 22 is not executable. After 21 completes, surface 22's checklist as the final deliverable along with the live URL.
- After every sub-goal, report: deliverables produced, verification commands run + outputs, any deviations from this plan.
- Do not modify code from Goals 1–18 unless cleanup or hardening explicitly requires it; if you do, justify in the summary.

## Critical files

- [`supabase/migrations/0002_rls.sql`](../supabase/migrations/0002_rls.sql) — RLS source of truth (sub-goal 19)
- [`wrangler.jsonc`](../wrangler.jsonc) — secrets bindings + cron triggers (sub-goals 20, 21)
- [`lib/supabase/types.ts`](../lib/supabase/types.ts) — regenerated against hosted in sub-goal 21
- [`SECURITY.md`](../SECURITY.md) — new in sub-goal 20
- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — new in sub-goal 21
- [`next.config.mjs`](../next.config.mjs) — dev-only guard audit (sub-goal 20)
- [`app/brand/page.tsx`](../app/brand/page.tsx) — prod gating (sub-goal 20)

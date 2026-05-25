# RVA James — Session Instructions

A James River conditions dashboard for Richmond, VA families. Next.js 15 (App Router) on Cloudflare Workers via `@opennextjs/cloudflare`, Supabase storage, Anthropic Claude for lazy AI interpretation. Live at https://rvajames.org.

---

## Stop-and-ask discipline

**Production credentials are not retrievable. Do not hunt for them.**

If a command needs production credentials that aren't in `.env.local` or `.dev.vars`, STOP and ask the user. Wrangler secrets at Cloudflare are encrypted at the edge — `wrangler secret list` shows names only, never values. There is no "alternative path" that works: the Supabase management API, the Cloudflare API, scanning `node_modules`, reading `.wrangler/` cache files — none of these will yield production secrets. One "stop and ask" is correct; twelve attempts to find the same secret is wasted compute and bad behavior.

**Production secret inventory** (known to exist, none retrievable from this directory):

| Secret | Where |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Wrangler secret (encrypted at edge) |
| `ANTHROPIC_API_KEY` | Wrangler secret (encrypted at edge) |
| `CRON_SECRET` | Wrangler secret (encrypted at edge) |
| `ALLOWED_ADMIN_EMAILS` | Wrangler secret (encrypted at edge) |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public — in `wrangler.jsonc` `vars` block |

**If anything fails twice in a row, STOP.** Diagnose the root cause before trying a third approach. Don't churn.

**Production READS are available to you** via the `agent_reader` Postgres role (SELECT-only on `public` schema, enforced by Postgres). Use them; you don't need to stop and ask the user for production data.

- `pnpm query:prod "<sql>"` — ad-hoc SELECT queries
- `pnpm sync:prod-to-local` — snapshot prod data into local Supabase

Writes to production remain impossible: the role is `SELECT`-only at the Postgres level. INSERT/UPDATE/DELETE return "permission denied" regardless of what client or command you use. See `docs/agent-read-only-setup.md` for the setup details and security posture.

**If a verification needs to WRITE to prod, STOP.** That requires the user. Don't try to escalate to `service_role` or other paths.

---

## Ways of working

### Start every session by reading the live state

1. `git log --oneline -10` — what's shipped recently
2. `git status` — what's modified locally
3. `docs/audit-reconciliation.md` — execution queue across all plans
4. `docs/<relevant-plan>.md` — the sub-goal you're about to execute

Do not trust conversation history alone; verify against the codebase. The reconciliation doc has gone stale faster than it gets updated before.

### Report after every sub-goal in this format

- **Deliverables** — files created/modified with one-line description each
- **Verification** — exact commands run + their outputs (tsc, lint, build, test, smoketest)
- **Deviations** — anything that diverged from the plan and why
- **Next step recommendation** — proceed, stop and verify, escalate to user

No exceptions. A sub-goal report without verification is not a finished sub-goal.

### When the plan is wrong, update the plan

Reality is the source of truth. If verification shows the plan's assumptions don't match the data (wrong field name, wrong endpoint, missing capability), STOP. Either patch the relevant `docs/*.md` plan file with the corrected approach, or surface the discrepancy to the user and wait. Do not silently work around an incorrect plan — the next session will inherit the same wrong assumptions.

### Decide vs ask

- **Decide** when the option is clear from the plan, the constraint, or established convention. Document the decision in the commit message.
- **Ask** when two reasonable options exist and the right choice depends on user intent we haven't captured. One short clarifying question beats ten minutes of guessing.

### Common commands

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Local dev | `supabase start && pnpm dev` |
| Run tests | `pnpm test` |
| Type check | `pnpm tsc --noEmit` |
| Lint | `pnpm lint` |
| Build for Cloudflare | `pnpm build:cf` |
| Preview Worker locally | `pnpm preview` |
| Deploy | `pnpm deploy:cf` (END OF ROUND ONLY) |
| Regenerate Supabase types | `supabase gen types typescript --linked > lib/supabase/types.ts` |
| Read prod (SELECT only) | `pnpm query:prod "<sql>"` |
| Snapshot prod → local | `pnpm sync:prod-to-local` (use `--yes` to skip prompt) |
| Modern web guidance | `npx -y modern-web-guidance@latest search "<query>"` |

---

## Project state and conventions

- **Plans live in `docs/*.md` as working notes.** Read `docs/audit-reconciliation.md` for the live execution queue. Read the specific `docs/<plan-name>.md` for the sub-goal you're executing.
- **Mobile-first.** 375px viewport baseline, 44px touch targets, no hover-only affordances. Desktop is responsive but the design language is mobile.
- **Lazy AI generation.** All Anthropic calls go through `lib/ai/get-or-generate.ts`, cached in Supabase by `prompt_hash`. Do NOT add cron jobs that pre-generate AI content.
- **Rules engine + AI hybrid.** Deterministic safety logic in `lib/safety/rules.ts` driven by `lib/safety/thresholds.json` (single source of truth, also embedded in the cached AI system prompt). AI narrates context; never determines status.
- **Cloudflare free-tier 5-cron limit is saturated.** Do NOT add new cron triggers. New ingests piggyback on existing handlers via the closure-source registry pattern (see `docs/closure-sources-expansion-plan.md`).
- **Single deploy at the end of each round.** Not after each sub-goal.
- **Use `git` for all changes.** Commit per sub-goal with `feat(sub-goal N): ...` convention visible in `git log --oneline`.
- **Modern web platform features** via `npx -y modern-web-guidance@latest search <query>` and `retrieve <id>` before implementing any UI pattern. The skill is installed locally per `skills-lock.json`.

---

## Verification preferences (in order)

1. **Code review** against the diff. Trust this when the change is structural and the logic is verifiable by reading.
2. **Direct prod read** for quick checks: `pnpm query:prod "<sql>"`. Read-only via `agent_reader` Postgres role. Best for "what does the data actually look like?" verification.
3. **Snapshot prod → local** for richer verification: `pnpm sync:prod-to-local`, then `supabase start && pnpm dev`. Local stack mirrors production data; full write access on local without touching prod. Best for testing migrations, scrape behavior, ingestion paths.
4. **Local dev with empty data**: `supabase start && pnpm dev`. Use when you want a clean slate.
5. **Wrangler preview** of the production worker build: `pnpm preview`.
6. **End-of-round deploy** + Lighthouse + smoketest against the live URL.
7. **Never**: hunt for production secrets, escalate to `service_role`, or try to write to prod via any path other than a deployed worker.

---

## Hard constraints

- Lighthouse mobile must remain **100/100/100/100** after each deploy.
- LCP element must be in deterministic content, NOT inside a `<Suspense>` boundary.
- RLS must remain enabled on every Supabase table; do not loosen.
- Do not add a new cron trigger (free-tier limit).
- Do not use `window.confirm()` (replaced by `<ConfirmDialog>` in sub-goal 53).
- Do not introduce AI generation outside the `lib/ai/get-or-generate.ts` pipeline.
- Do not commit production secrets or session tokens to git.

---

## When in doubt

Read `docs/audit-reconciliation.md`, then ask the user. Asking is cheap; guessing wrong is expensive.

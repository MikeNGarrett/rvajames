# Security

## Admin route auth

The `/admin/*` route is protected by two independent layers:

### Layer 1 — Cloudflare Access (edge)

Cloudflare Access intercepts all requests to `rvajames.org/admin` before they
reach the Worker. Unauthenticated requests are redirected to the Cloudflare
login page. Authenticated sessions are validated by Cloudflare's JWT middleware,
which sets the `cf-access-authenticated-user-email` header.

Configuration: Zero Trust → Access → Applications → Self-hosted → `rvajames.org/admin`

### Layer 2 — Allowlist check (defence-in-depth, in code)

`lib/admin/auth.ts` reads `cf-access-authenticated-user-email` and verifies it
is in the `ALLOWED_ADMIN_EMAILS` env var (comma-separated, case-insensitive).
If the header is absent or the email is not in the allowlist, `requireAdminEmail()`
throws `Response('Forbidden', { status: 403 })`.

This second check prevents accidental access if:
- The Cloudflare Access policy is misconfigured
- A request somehow bypasses the edge (e.g. direct Worker URL)

### What the admin route can do

`/admin/closures` allows authenticated admins to:
- Create, edit, and expire access-point closures
- Approve or discard draft closures created by automated scrapers
- Duplicate existing closures (e.g. recurring annual closures)

All admin writes use the Supabase **service role key** (bypasses RLS).
Admin reads are also service-role to ensure draft rows are visible.

### `ALLOWED_ADMIN_EMAILS`

This secret must be set in Cloudflare Workers secrets:
```bash
echo "admin@example.com" | wrangler secret put ALLOWED_ADMIN_EMAILS
```
Rotating access: update the env var and redeploy. No code change needed.

---

## RLS posture

Row Level Security is enabled on all seven Supabase tables:
`locations`, `activities`, `location_activities`, `conditions_snapshots`,
`advisories`, `ai_interpretations`, `ingestion_runs`.

Each table has a single `anon_read` policy that allows anonymous clients to
`SELECT` but not `INSERT`, `UPDATE`, or `DELETE`. Cron routes authenticate
with the service role key, which bypasses RLS — those routes are the only
path that writes data.

Migration: `supabase/migrations/0002_rls.sql`

## Secrets

| Name | Used by | Rotation |
|---|---|---|
| `SUPABASE_URL` | All server-side Supabase calls | Permanent per project |
| `SUPABASE_ANON_KEY` | Public reads (anon PostgREST) | Rotate if leaked |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron write routes | Rotate immediately if leaked |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side Supabase URL (build-time) | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key (build-time) | Same as SUPABASE_ANON_KEY |
| `ANTHROPIC_API_KEY` | AI interpretation cron | Rotate immediately if leaked |
| `CRON_SECRET` | Guards all `/api/cron/*` endpoints | Rotate if leaked; update Worker secret + Wrangler trigger config |
| `ALLOWED_ADMIN_EMAILS` | Admin route email allowlist | Update to add/remove admin access |

In production, secrets are stored in Cloudflare Workers secrets via `wrangler secret put`.
`NEXT_PUBLIC_*` vars are set as plain `vars` in `wrangler.jsonc` (build-time accessible, not secret).

Never commit `.env.local` or `.dev.vars` — both are gitignored.

## CRON_SECRET purpose

Every `/api/cron/*` route checks for this value in either the `x-cron-secret`
header or the `Authorization: Bearer <secret>` header before processing.
Cloudflare Cron Triggers call the route over the public internet on the same
Workers domain, so this secret prevents unauthorized triggering of data-write
operations.

Implementation: `lib/ingest/run.ts` — `guardCronSecret(request)`

## AI cost ceiling

The interpret cron runs once per day (`15 6 * * *`) and generates at most 45
interpretations (9 locations × 5 age buckets). Deduplication by SHA-256
prompt hash prevents re-generating interpretations that already exist for the
same date + location + age bucket + prompt content.

Approximate daily ceiling at list prices (2025):
- Haiku 4.5 (standard): ~$0.02–0.05 / day
- Sonnet 4.6 (high-severity escalation): adds ~$0.05–0.20 on advisory days

The `/status` page displays today's estimated cost and warns if it exceeds $1.

## Reporting issues

Open an issue at the project repository or contact mike.garrett@teamcolab.com.

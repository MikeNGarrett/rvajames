# Deployment

## Live URL

**https://rva-james.mike-garrett.workers.dev**

Production domain: https://rvajames.org (custom domain via Cloudflare)

## Deploy details

- **Platform:** Cloudflare Workers (OpenNext adapter)
- **Worker name:** `rva-james`
- **Account:** `mike-garrett`
- **Supabase project:** `buokjdntsitjpqfjxano` (hosted)
- **First deploy:** 2026-05-23
- **Version ID:** `f08c5d38-5b23-4769-8054-7289103fb658`

## Admin route

`/admin/*` is protected by two layers:

1. **Cloudflare Access** (edge) — set up a Self-hosted Application in the Cloudflare Access
   dashboard (Zero Trust → Access → Applications → Add an application → Self-hosted).
   - Application name: `RVA James Admin`
   - Application domain: `rvajames.org/admin`
   - Policy: allow the email addresses you want to grant access to.
   Cloudflare Access sets the `cf-access-authenticated-user-email` header on authenticated
   requests.

2. **Allowlist check** (defence-in-depth, in code) — `lib/admin/auth.ts` reads that header
   and verifies the email is in the `ALLOWED_ADMIN_EMAILS` env var (comma-separated list).

### Required env var

```
ALLOWED_ADMIN_EMAILS=you@example.com,colleague@example.com
```

Set this as a Cloudflare Workers secret:

```bash
echo "you@example.com" | wrangler secret put ALLOWED_ADMIN_EMAILS
```

### Local testing

In `.dev.vars`, set:

```
ALLOWED_ADMIN_EMAILS=your.email@example.com
```

Then pass the header manually (e.g. with curl or a browser extension):

```
cf-access-authenticated-user-email: your.email@example.com
```

See `SECURITY.md` for the full admin auth posture.

## Secrets (names only — values in Cloudflare Workers dashboard)

Set via `wrangler secret put`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- `ALLOWED_ADMIN_EMAILS`

Public vars in `wrangler.jsonc`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Cron schedule

5 triggers (Cloudflare Workers free-plan limit is 5 per account).

| Route | Schedule | Description |
|---|---|---|
| `/api/cron/usgs` | `*/15 * * * *` | USGS gage data (every 15 min) |
| `/api/cron/nws` | `0 * * * *` | NWS weather/alerts **+ NOAA AHPS 72h forecast** (hourly) |
| `/api/cron/usgs-percentiles` | `0 3 * * *` | USGS historical discharge percentiles **+ rva.gov closure scrape** (daily 3am) |
| `/api/cron/jra` | `0 12 * * *` | JRA water quality (daily noon) |
| `/api/cron/cso` | `0 6,18 * * *` | RVA CSO advisories (6am + 6pm) |

> **Why NWS and NOAA AHPS share one trigger:** Both are federal water/weather feeds on hourly cadence. Sharing a slot keeps us within the free-plan limit. The standalone `/api/cron/noaa-ahps` endpoint still exists for manual triggering.
>
> To upgrade and restore a dedicated NOAA AHPS trigger: upgrade to Workers Paid plan, then add `"30 * * * *"` back to `wrangler.jsonc` and remove the NOAA call from `/api/cron/nws/route.ts`.

## First manual trigger — 2026-05-23

| Source | Result |
|---|---|
| USGS | `ok: true, rows: 9` |
| NWS | `ok: true, rows: 1` |
| JRA | `ok: true, rows: 1` |
| CSO | `ok: true, rows: 0` (no active overflow) |
| Interpret | `ok: true, rows: 22` (partial via HTTP; cron has 15-min window for all 45) |

## Deploying updates

```bash
pnpm build:cf   # build OpenNext bundle
pnpm deploy:cf  # deploy to Cloudflare Workers
```

Secrets are persisted in Cloudflare and survive redeployment. To rotate a secret:
```bash
echo "new-value" | wrangler secret put SECRET_NAME
```

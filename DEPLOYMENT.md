# Deployment

## Live URL

Production: **https://rvajames.org** (custom domain via Cloudflare)

The Worker also serves at its `*.workers.dev` URL, but the canonical user-facing
URL is rvajames.org. All metadata (OG tags, sitemap, canonical links) points
to the custom domain.

## Platform

- **Hosting:** Cloudflare Workers via the [OpenNext](https://opennext.js.org/cloudflare) adapter
- **Storage:** Supabase (hosted Postgres)
- **AI:** Anthropic Claude (Haiku default, Sonnet escalation on high-severity advisories)
- **Build target:** `pnpm build:cf` → OpenNext worker bundle; `scripts/patch-worker.mjs` injects the cron scheduled() handler post-build.

Maintainer-specific values (Cloudflare account name, Supabase project ref,
deploy version IDs) are intentionally not documented here — they're either
operational metadata that changes per-deploy or aren't useful to external
readers. The Worker bindings page in the Cloudflare dashboard is the
authoritative source for the running configuration.

## Admin route

`/admin/*` is protected by three layers:

1. **Cloudflare Access** (edge) — set up a Self-hosted Application in the Cloudflare Access
   dashboard (Zero Trust → Access → Applications → Add an application → Self-hosted).
   - Application name: `RVA James Admin`
   - Application domain: `rvajames.org/admin`
   - Policy: allow the email addresses you want to grant access to.
   Cloudflare Access attaches a signed `Cf-Access-Jwt-Assertion` token (and the
   plaintext `cf-access-authenticated-user-email` header) to authenticated requests.

2. **In-Worker JWT verification** (SEC-1, in code) — `lib/admin/auth.ts` verifies the
   `Cf-Access-Jwt-Assertion` signature against the team JWKS
   (`https://$CF_ACCESS_TEAM_DOMAIN/cdn-cgi/access/certs`) and enforces
   `aud` (= the Access app's AUD tag), `iss`, `exp`, and `nbf`. The admin email comes
   from the **verified token**, never the plaintext header — a spoofed header without a
   valid JWT gets 403 even if a request somehow reaches the Worker without passing
   through Access. Verification activates only when both `CF_ACCESS_*` vars are set and
   `NODE_ENV === 'production'`; otherwise the pre-SEC-1 header fallback applies (local dev).

3. **Allowlist check** (defence-in-depth, in code) — the email (from the verified token,
   or the header in local dev) must be in the `ALLOWED_ADMIN_EMAILS` env var.

### Required env vars

```
ALLOWED_ADMIN_EMAILS=you@example.com,colleague@example.com
CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com   # host only, no scheme
CF_ACCESS_AUD=<Access application Audience tag>      # Zero Trust → Access → Applications → RVA James Admin → Overview
```

Set these as Cloudflare Workers secrets:

```bash
echo "you@example.com" | wrangler secret put ALLOWED_ADMIN_EMAILS
echo "<team>.cloudflareaccess.com" | wrangler secret put CF_ACCESS_TEAM_DOMAIN
echo "<aud-tag>" | wrangler secret put CF_ACCESS_AUD
```

### Local testing

In `.env.development.local` (Wrangler reads it via the `.dev.vars` symlink), set:

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

## Verifying after deploy

After `pnpm deploy:cf`, exercise each cron endpoint with the production
`CRON_SECRET` to confirm the deploy is healthy. The full verification
sequence:

```bash
# Replace with your actual CRON_SECRET (stored via wrangler secret put)
for source in usgs nws jra cso; do
  curl -sw '\n%{http_code} %{time_total}s\n' \
    -H "x-cron-secret: $CRON_SECRET" \
    https://rvajames.org/api/cron/$source
  echo "---"
done
```

Each response is a JSON `RunResult`:
- `{"ok": true, "rowsWritten": N}` — success, N rows persisted
- `{"ok": false, "error": "..."}` — failure with a descriptive error

`rowsWritten` will be zero for data sources that genuinely have no new rows
(off-season JRA samples, no CSO overflow today, etc.). That's healthy. A
non-zero count is only meaningful relative to what each source produces.

## Deploying updates

```bash
pnpm build:cf   # build OpenNext bundle
pnpm deploy:cf  # deploy to Cloudflare Workers
```

Secrets are persisted in Cloudflare and survive redeployment. To rotate a secret:
```bash
echo "new-value" | wrangler secret put SECRET_NAME
```

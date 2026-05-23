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

## Secrets (names only — values in Cloudflare Workers dashboard)

Set via `wrangler secret put`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`

Public vars in `wrangler.jsonc`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Cron schedule

| Route | Schedule | Description |
|---|---|---|
| `/api/cron/usgs` | `*/15 * * * *` | USGS gage data (every 15 min) |
| `/api/cron/nws` | `0 * * * *` | NWS weather/alerts (hourly) |
| `/api/cron/jra` | `0 12 * * *` | JRA water quality (daily noon) |
| `/api/cron/cso` | `0 6,18 * * *` | RVA CSO advisories (6am + 6pm) |
| `/api/cron/interpret` | `15 6 * * *` | AI interpretations (daily 6:15am) |

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

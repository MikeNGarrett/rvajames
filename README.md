# RVA James

Family trip dashboard for the James River — Richmond, VA.

## First-time setup

### Prerequisites

- Node.js 20+ and pnpm (`npm i -g pnpm`)
- Docker (for Supabase local stack)
- Supabase CLI: `brew install supabase/tap/supabase`
- Wrangler (installed as a project devDep — use `pnpm wrangler`)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the local Supabase stack

```bash
supabase start
```

This downloads Docker images on first run. When it finishes, copy the printed keys:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
```

### 3. Populate env files

```bash
cp .env.local.example .env.local
cp .dev.vars.example .dev.vars
```

Fill in `.env.local` and `.dev.vars` with the values from `supabase start`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | API URL from above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_URL` | same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

### 4. Run the dev server

```bash
pnpm dev
```

Visit [http://localhost:3000/supabase-check](http://localhost:3000/supabase-check) to verify connectivity.

> **Note:** The route is at `/supabase-check` (not `/_supabase-check`). In Next.js App Router, the `_` prefix opts a folder out of routing, so the folder is named `app/supabase-check`. This route will be deleted in Goal 11.

### 5. Preview the Cloudflare Worker locally

```bash
pnpm build:cf
pnpm preview
```

The Worker serves on `http://localhost:8787`.

---

## Key commands

| Command | Description |
|---|---|
| `pnpm dev` | Next.js dev server (localhost:3000) |
| `pnpm build` | Next.js production build |
| `pnpm build:cf` | OpenNext Cloudflare bundle |
| `pnpm preview` | Local Worker preview via wrangler |
| `pnpm deploy:cf` | Deploy to Cloudflare Workers |
| `pnpm lint` | ESLint |
| `supabase start` | Start local Supabase stack |
| `supabase stop` | Stop local Supabase stack |
| `supabase gen types typescript --local > lib/supabase/types.ts` | Regenerate DB types after migrations |

---

## Notes

- `supabase link` to a hosted project is deferred until the first preview deploy (after Goal 4 schema).
- Worker secrets for production: `pnpm wrangler secret put <VAR_NAME>`.

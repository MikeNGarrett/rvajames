# RVA James

**A family-friendly James River conditions dashboard for Richmond, Virginia.**

Live at [rvajames.org](https://rvajames.org).

There are a half-dozen places to read raw USGS gage data, NWS forecasts, and James River Watch bacterial samples. None of them tell a parent in Richmond, in plain language, *whether it's safe to take a four-year-old to skip rocks at Belle Isle today*. This app does — by pulling the data on a schedule, running it through a deterministic safety-rules engine, and layering a small amount of AI on top to translate conditions into experience.

## Who it's for

Richmond families with kids who want to spend a day at the river without spending an hour piecing together gauge readings, advisories, weather, and trail closures from five different websites first.

The app shows nine specific access points — Belle Isle, Pony Pasture, Texas Beach, Browns Island, Mayo Island, Shiplock Trail, North Bank Trail, Buttermilk Trail, Pump House — with status, recommendations tailored to the youngest family member's age band, and a per-location detail page with resources and activity guidance.

## What it does

- **Pulls live data** from USGS (two gages, historical percentiles), NWS (forecast + alerts), NOAA AHPS (72-hour flood forecast), James River Association (water quality), and rva.gov (CSO + park closures) on Cloudflare Cron Triggers.
- **Applies a deterministic rules engine** (`lib/safety/rules.ts` + `lib/safety/thresholds.json`) to compute a status (safe / caution / danger / closed) per access point. The same thresholds drive the at-a-glance UI and the AI prompt — single source of truth.
- **Layers AI on top, lazily.** Anthropic Claude (Haiku by default, Sonnet on high-severity advisories) generates a metro-river summary and per-location interpretations *only when a visitor requests them*. Results are cached in Supabase keyed by a prompt hash so repeat visits cost nothing.
- **Respects age bands.** A "youngest child" selector (0-2 / 3-5 / 6-9 / 10-13 / 14+ / none) tailors the language and the recommended activities, grounded in AAP, NPS, and USCG guidance.
- **Surfaces closures and advisories prominently.** A trail being out for months structurally outranks "the river is fine today" in the UI — closed locations sort to the top with a distinct treatment (gray with a lock icon, not danger red).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript | Server Components + streaming + edge-runtime support |
| Hosting | Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | Cheap, fast, global. Replaced `@cloudflare/next-on-pages` (deprecated) early. |
| Database | [Supabase](https://supabase.com) (Postgres) | Generated TypeScript types, RLS for anon read-only access, service-role for ingest writes |
| AI | [Anthropic Claude API](https://docs.anthropic.com) — Haiku default, Sonnet on escalation | Prompt caching keeps cost negligible; lazy on-demand generation cached in Supabase |
| Styling | Tailwind CSS v4 (CSS-first via `@theme`) | No JS config; container queries native |
| Validation | [Zod](https://zod.dev) | Runtime validation at every external boundary (API ingest, AI output) |
| Scraping | [cheerio](https://cheerio.js.org) | Works on Workers with `nodejs_compat` |
| Auth (admin only) | Cloudflare Access | Zero-trust gate; no auth code to maintain |
| Tests | Vitest | Pure-function rules-engine coverage |

## Architecture at a glance

```
                                                                  
   ┌──────────────────┐    ┌──────────────────┐                     
   │ USGS  (15 min)   │    │ NWS+NOAA (hourly)│   Cloudflare Cron   
   │ JRA   (daily)    │    │ RVA closures (1d)│   Triggers          
   │ RVA CSO (12h)    │    │ USGS pct (daily) │                     
   └────────┬─────────┘    └────────┬─────────┘                     
            │                       │                               
            └───────────┬───────────┘                               
                        ▼                                           
                ┌───────────────┐                                   
                │   Supabase    │   conditions_snapshots,           
                │   (Postgres)  │   advisories, location_status,    
                │               │   usgs_percentiles, ...           
                └───────┬───────┘                                   
                        │                                           
                        ▼                                           
            ┌───────────────────────┐                               
            │   Next.js Server      │                               
            │   Components on       │                               
            │   Cloudflare Workers  │                               
            └───────────┬───────────┘                               
                        │                                           
              Rules engine (deterministic)                         
                        │                                           
                        ▼                                           
            ┌───────────────────────┐                               
            │   Page render         │                               
            │   • Deterministic UI  │                               
            │   • <Suspense>        │                               
            │      └─► Lazy AI ─────┼──► Anthropic (Haiku/Sonnet)    
            │           cached     │      + cached system prompt    
            │           in DB      │                                
            └───────────────────────┘                               
```

## Decisions and references

The full decision trail lives in `docs/`. Highlights:

- **Mobile-first, always.** Families check on the way to the river. Touch targets ≥44px, single-column at 375px viewport, no hover-only affordances. Desktop is responsive (capped at ~896px in the main column) but the design language is mobile. See `docs/responsive-guidelines.md` (after Round 9 sub-goal 48).
- **Two USGS gages, different datums, never compared numerically.** Westham (02037500) for safety thresholds (gage height in feet, established normal range). City Locks (02037705) for downriver tidal context (NAVD 1988 elevation). The system prompt and rules engine explicitly know they're not comparable.
- **Lazy AI, not cron.** Original plan generated 45+ interpretations daily on a cron. That's pure waste at low traffic. Switched to on-demand generation with `lib/ai/get-or-generate.ts` cached in Supabase by prompt hash. UNIQUE constraint handles concurrent-write races. Net cost at current traffic: pennies per month.
- **Rules engine + AI hybrid, not pure AI.** The homepage location cards are deterministic — a status pill computed from `lib/safety/rules.ts`. AI narration only appears in the metro summary at top and on per-location detail pages, where its voice and nuance earn their keep. Avoids 9 AI calls per homepage visit.
- **Prompt caching is critical.** The cached system prompt (~6200 tokens) holds brand voice, location encyclopedia, activity matrix, age-band reference (AAP/NPS/USCG-grounded), and safety thresholds. Per-call input is just today's conditions + advisories + age bucket. First call of the day pays cache-create; everything else reads cache.
- **Modern web platform over polyfills.** Native `<dialog>` with `closedby="any"`. Container queries via Tailwind v4 `@container`. `text-wrap: balance` and `pretty`. Speculation Rules for prefetch. The [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) skill (installed via `skills-lock.json`) informs component-level decisions; see `docs/modern-web-evaluation-findings.md`.
- **Closures are operational state, not weather advisories.** Stored in a separate `location_status` table with `kind` enum (`open` / `restricted` / `closed` / `closed_indefinite`). A closed location overrides weather-based status entirely.
- **Manual admin entry for closures; rva.gov scrape produces drafts for review.** No automated Facebook/Instagram ingest — ToS and brittleness. Admin route at `/admin/closures` (Cloudflare Access-gated).

### Plans, audits, and historical context

Everything is in `docs/`:

| File | What it covers |
|---|---|
| `audit-reconciliation.md` | Live execution queue across all rounds + plans |
| `feedback-round-1-plan.md` | Initial 28-sub-goal foundation build |
| `deploy-hardening-plan.md` | RLS, hosted Supabase, first deploy |
| `homepage-rapids-redesign-plan.md` | Rapids class + river-wide activity grid |
| `river-conditions-redesign-plan.md` | Gauge bar, sparkline, detail modal |
| `closures-and-forecast-plan.md` | NOAA forecast + operational status + admin UI |
| `modern-web-evaluation-plan.md` + `…-findings.md` | Modern web audit and 23 findings |
| `round-5-quick-wins-plan.md` | Audit follow-ups — small fixes |
| `responsive-scaffolding-plan.md` | Mobile-first → desktop responsive (in flight) |
| `howsthejamesrva-investigation.md` | Competitive landscape investigation |
| `brand.md` + `brand-source-notes.md` | Richmond brand voice + color tokens |

## Running locally

### Prerequisites

- Node.js 20+ and pnpm (`npm i -g pnpm`)
- Docker Desktop (for the local Supabase stack)
- Supabase CLI (`brew install supabase/tap/supabase`)
- An Anthropic API key for AI generation (optional for most local work; required to test the lazy AI path end-to-end)

### One-time setup

```bash
git clone <this repo>
cd rva-james
pnpm install

# Start the local Supabase stack
supabase start
# Note the printed URL, anon key, and service_role key

# Copy env templates
cp .env.local.example .env.local
cp .dev.vars.example .dev.vars
```

Populate `.env.local` and `.dev.vars` with:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL (`http://127.0.0.1:54321` locally) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from `supabase start` |
| `SUPABASE_URL` | same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | same as anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from `supabase start` |
| `ANTHROPIC_API_KEY` | your Anthropic API key (optional locally) |
| `CRON_SECRET` | any random string for local cron testing |

### Run

```bash
pnpm dev                 # Next.js dev at http://localhost:3000
```

For a faithful preview of the Cloudflare Worker build:

```bash
pnpm build:cf            # OpenNext build
pnpm preview             # Local Worker at http://localhost:8787
```

### Triggering cron jobs locally

Hit each cron route directly with the `CRON_SECRET` header:

```bash
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/usgs
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/nws
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/jra
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/cso
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/usgs-percentiles
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/noaa-ahps
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/rva-closures
```

Each returns `{ ok, rowsWritten }` on success.

### Tests

```bash
pnpm test                # Vitest — pure-function rules engine + ingest
```

### Key commands

| Command | Description |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build:cf` | OpenNext Cloudflare bundle |
| `pnpm preview` | Local Worker preview |
| `pnpm deploy:cf` | Deploy to Cloudflare Workers |
| `pnpm test` | Vitest |
| `pnpm lint` | ESLint |
| `supabase db push` | Apply migrations to linked project |
| `supabase gen types typescript --local > lib/supabase/types.ts` | Regenerate DB types |

## Project structure

```
app/
  page.tsx                       Homepage (deterministic + lazy AI)
  layout.tsx                     Brand font, metadata
  globals.css                    Tailwind v4 @theme + tokens
  locations/[slug]/              Per-location detail
  safety/                        Safety + sources page
  status/                        Ingestion + cost dashboard
  admin/closures/                Cloudflare Access-gated closure admin
  api/cron/<source>/route.ts     Each ingest job
  _dev/                          Dev-only routes (NODE_ENV gated)
  brand/                         Brand token showcase (dev-gated)
components/
  metro/                         RiverSegmentPanel, MetroSummaryPanel,
                                 RiverConditionsDetailDialog,
                                 RiverWideActivityGrid
  tiles/                         RiverLevelTile, AdvisoriesBanner, ...
  ui/                            PageContainer, HorizontalGauge,
                                 Sparkline, TrendArrow
  filters/                       ConditionsForm
  location/                      ActivityMatrix, ResourceList
  legal/                         DisclaimerFooter, FirstVisitModal
  banners/                       FloodBanner
lib/
  ai/                            client, get-or-generate, system-prompt,
                                 prompts/{interpret-location, summarize-metro}
  ingest/                        One file per data source + run.ts wrapper
  queries/                       Server-side data fetchers per surface
  safety/                        rules.ts + thresholds.json (single source
                                 of truth shared with the AI prompt)
  supabase/                      Server + browser clients, generated types
supabase/migrations/             0001..0009 schema evolution
docs/                            Plans, audits, decision history
```

## Adapting this to your own river / city / location

The architecture is general-purpose; the data is local. To stand up a version for another waterway:

### 1. Replace the location data

In `supabase/migrations/0001_init.sql` (and 0003 for the gauge entries), replace:
- The 9 access-point seed rows with your own access points
- The two USGS gauge entries with the gauges that cover your river (find them at [waterdata.usgs.gov](https://waterdata.usgs.gov)). Confirm which parameter codes are useful — `00065` (gage height), `00060` (discharge), `00010` (water temp), `62620` (tidal/regulated elevation).

### 2. Replace the data-source URLs

- `lib/ingest/usgs.ts` — gage IDs and parameter codes
- `lib/ingest/usgs-percentiles.ts` — historical percentile fetch (same station list)
- `lib/ingest/nws.ts` — NWS grid point for your city (find via `https://api.weather.gov/points/{lat},{lon}`)
- `lib/ingest/noaa-ahps.ts` — AHPS forecast gauge ID (find at [water.noaa.gov](https://water.noaa.gov))
- `lib/ingest/jra.ts` — replace with your region's bacterial water-quality program (Riverkeeper, Waterkeeper Alliance member, etc.); may require rewriting the scrape entirely
- `lib/ingest/cso.ts` — your city's combined-sewer-overflow advisory page (may not exist for separate-sewer cities; remove if so)
- `lib/ingest/rva-closures.ts` — your city/parks closure announcement page

### 3. Replace safety thresholds

Edit `lib/safety/thresholds.json` for your river's characteristics:
- Gage height bands (`normal_max_ft`, `flood_stage`, etc.) — pull from NWS AHPS for your gauge
- Activity-specific thresholds (`gage_safe_max_ft` per activity)
- Rapids class bands (varies by river; James River below the Fall Line is unusual — your river may not have rapids at all)
- Bacterial CFU thresholds (usually EPA standards: 235 E. coli / 100mL)

The rules engine in `lib/safety/rules.ts` reads from this JSON — no code changes needed if your river fits the same value shape.

### 4. Rewrite the cached AI system prompt

`lib/ai/system-prompt.ts` is the heart of the personality. Update:
- The location encyclopedia (terrain notes, hazards, parking, distance from gauges)
- Brand voice section
- Any city-specific guidance (e.g., the James River's Fall Line and tidal vs. free-flowing reach distinction will differ for your river)

Note: the AI is told to derive nothing it shouldn't — every safety claim is grounded in `thresholds.json`. Maintain this discipline.

### 5. Replace brand tokens

`app/globals.css` `@theme` block defines colors. Replace Richmond's `rva-blue` etc. with your city's brand or an independent palette. AA contrast verified programmatically in `docs/brand.md`.

### 6. Replace per-location resource links

`supabase/migrations/0006_location_resources.sql` seeds the resource links per access point. Rewrite for your locations — your local parks department, riverkeeper, NPS unit, etc.

### 7. Update copy

- `app/safety/page.tsx` — your local emergency services + relevant authorities
- `components/legal/DisclaimerFooter.tsx` — adjust if local liability framing differs
- `components/legal/FirstVisitModal.tsx` — first-visit copy
- Site metadata in `app/layout.tsx`

### 8. Cloudflare + Supabase + domain

- Create a Cloudflare Workers account and a Supabase project
- `wrangler secret put` the four secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`)
- Add public vars to `wrangler.jsonc`
- `supabase link --project-ref <yours>` and `supabase db push`
- `pnpm deploy:cf`
- Configure your domain in the Cloudflare dashboard
- Set up Cloudflare Access for `/admin/*` with allowed admin email(s)

### 9. Test the full data flow

Trigger each cron route against the deployed Worker, confirm `ingestion_runs` rows show `ok=true`, visit the homepage. The deterministic side renders instantly; the AI side warms on first visit per (date, age bucket) combo.

### What this codebase is and isn't

**Is:** A serviceable starting point for any city-river dashboard targeting families. The patterns — deterministic rules + lazy AI cached in Supabase, cron-driven ingest, modal-and-disclosure UX — are reusable.

**Isn't:** A turnkey SaaS, a generic data dashboard framework, or production code for high-traffic use. It's tuned for one specific river, one specific audience, and traffic that fits in Cloudflare Workers' free tier. If your river is dramatically different — significant ice formation, tidal-only with no free-flowing reach, no public gauges — expect to rewrite more than you reuse.

## License

See `LICENSE`. The data sources have their own licenses and terms; respect upstream attribution requirements (USGS public domain, NWS public domain, James River Association attribution requested, OSM if you add map tiles, etc.).

## Acknowledgments

- USGS Water Services and NOAA AHPS for the public hydrology data that makes any of this possible
- The James River Association for their volunteer-driven James River Watch bacterial sampling program
- The City of Richmond Department of Public Utilities for the CSO advisory feed
- The James River Park System volunteers who keep the access points open
- The [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) team for the guide library that informs many UI decisions in this codebase

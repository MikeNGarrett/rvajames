# RVA James — Expand Closure Source Coverage

## Context

User reported two real closures the app currently doesn't surface:

1. **Brown's Island** — closed November 17, 2025 through October 2026 for a $30M improvement project; full completion early 2027. *Brown's Island is one of our 9 access points (index 4).*
2. **Pipeline Trail** — closed indefinitely since September 13, 2024 after a sewage-pipe failure and ongoing safety concerns. *Pipeline Trail is NOT one of our 9 access points today.*

The existing `lib/ingest/rva-closures.ts` (Round 4 sub-goal 45) scrapes rva.gov for closure announcements and creates draft `location_status` rows for admin review. The Pipeline closure exists on rva.gov but it's not clear the current scrape is catching it. Brown's Island is a Venture Richmond project — Venture Richmond is the public-private partner running the work — and lives entirely outside rva.gov.

## Research findings — authoritative sources

### Brown's Island

- **Primary:** [Venture Richmond — Brown's Island Improvement Plan](https://venturerichmond.com/browns-island-improvement-plan/) — operator/partner page with closure dates, construction timeline, milestones, and a periodically-updated "Construction Updates" gallery (last update May 18, 2026).
- **Index of all Venture Richmond announcements:** [venturerichmond.com/news/](https://venturerichmond.com/news/) — their main news blog; would also catch future projects affecting any of the riverfront properties they manage.
- **Corroborating news:** [WRIC](https://www.wric.com/news/local-news/richmond/browns-island-closure-date/), [WTVR/CBS6](https://www.wtvr.com/news/local-news/browns-island-makeover-update-dec-2-2025), [Richmond Free Press](https://m.richmondfreepress.com/news/2025/aug/28/browns-island-upgrades-will-sideline-friday-cheers-next-year/), [GRPVA](https://www.grpva.com/news/browns-island-set-for-30-million-facelift-this-fall/), [The Richmonder](https://www.richmonder.org/friday-cheers-to-take-a-year-off-in-2026-for-browns-island-construction/).

### Pipeline Trail

- **Primary (official):** [rva.gov — Pipeline Trail Closure Update (Sept 13, 2024)](https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-closure-update) — original City of Richmond DPU announcement.
- **Primary (official FAQ):** [rva.gov — "Pipeline Trail" FAQs](https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-faqs).
- **Community partner:** [Friends of James River Park — "What's Going On With Pipeline?"](https://jamesriverpark.org/whats-going-on-with-pipeline/) — independent watchdog perspective; updates as the situation evolves; site has a date-organized news structure (URL pattern `/YYYY/MM/DD/slug/`) with JSON-LD schema markup.
- **Corroborating news:** [WRIC](https://www.wric.com/news/local-news/richmond/richmond-james-river-park-pipeline-closure/), [WTVR/CBS6](https://www.wtvr.com/news/local-news/richmond-pipeline-trail-closed-sept-13-2024), [Axios Richmond](https://www.axios.com/local/richmond/2024/09/13/richmond-pipeline-trail-closure-permanent), [Commonwealth Times](https://commonwealthtimes.org/2024/10/02/city-closes-pipeline-trail-citing-safety-concerns/), [RVAHub](https://rvahub.com/2024/09/19/friends-of-james-river-explain-pipeline-closure/).

### Source assessment — scrape-ability and licensing

| Source | Structured data | Index page | Volatility | ToS/scrape risk |
|---|---|---|---|---|
| `rva.gov` press releases | None (no RSS, no JSON-LD on individual pages) | `/press-releases-and-announcements/news` (city-wide); DPU-specific filter URL is the question | Low (a few per month) | Public-sector, allowed for non-commercial monitoring |
| `venturerichmond.com/news/` | Unknown — needs investigation during execution | `/news/` (blog index) | Low (monthly cadence) | Commercial site; check robots.txt and ToS during sub-goal 59 |
| `venturerichmond.com/browns-island-improvement-plan/` | Dated "Construction Updates" gallery | Single project page | Low–medium (project page updates as construction progresses) | Same as above |
| `jamesriverpark.org` | JSON-LD on article pages | Site-level news archive (exact URL TBD during execution) | Low–medium | Non-profit; likely scrape-friendly with attribution |

## Confirmed scope decisions

- **Manual admin entry remains the source of truth.** All scraped findings create **DRAFT** `location_status` rows that require admin approval before going live. This is consistent with sub-goal 45's pattern and was a deliberate choice from Round 4.
- **Three sources to add, all via the existing scrape pattern:** Venture Richmond, Friends of James River Park, and (verifying) rva.gov DPU coverage.
- **No new Cloudflare cron triggers.** The free-tier 5-trigger limit is already saturated (`*/15` USGS, `0 *` NWS+AHPS, `0 3` USGS-percentiles+rva-closures, `0 12` JRA, `0 6,18` CSO). The existing `rva-closures` ingest already piggybacks on the `usgs-percentiles` daily 03:00 UTC cron via `app/api/cron/usgs-percentiles/route.ts`. **Venture Richmond and JRPS scrapes piggyback on the same cron handler** as sibling closure-source modules. No `wrangler.jsonc` changes.
- **Refactor closures ingest into a multi-source registry pattern.** Instead of one monolithic `rva-closures.ts` module, each closure source (rva.gov, Venture Richmond, JRPS) becomes its own module under `lib/ingest/closures/sources/`, registered in a single registry. The cron handler invokes `runAllClosureSources()` which iterates the registry and aggregates results. Adding a fourth source later requires only a new module + registry entry.
- **No Facebook/Instagram integration.** Already a confirmed non-goal from Round 4.
- **Pipeline Trail becomes a 10th access point** with a permanent `closed_indefinite` status. Avoids inventing new schema for a single landmark. Users who have heard of Pipeline Trail by word-of-mouth get the official "here's why it's closed and where to go instead."
- **Brown's Island closure backfill** uses the existing admin UI — manual entry referencing the Venture Richmond source. The new Venture Richmond scraper picks up future updates.

## Continues sub-goal numbering: 58 → 62

---

## Sub-goal 58 — Audit rva.gov scrape and refactor into multi-source registry

**Why:** Two foundations need to land before adding new sources. First, verify the existing rva.gov scrape covers the DPU press-release path where the Pipeline Trail closure lives. Second, refactor the current single-module ingest into a pluggable registry so sub-goals 59 and 60 just add modules — no new cron route, no new wrangler trigger, no copy-paste of scrape boilerplate.

**Deliverables**

### Audit
- Read `lib/ingest/rva-closures.ts`. Document the URLs it currently scrapes, the page-content selectors, and the dedup hash strategy.
- Confirm the scrape covers `https://www.rva.gov/press-releases-and-announcements-public-utilities/news/*`. If it only covers Parks & Rec or a different sub-path, extend the URL list.
- Verify the scrape picked up (or would now pick up) the Pipeline Trail closure announcement. Force a re-run (or clear the content-hash cache for that URL) and confirm a draft `location_status` row is produced.

### Refactor to multi-source registry
- Create `lib/ingest/closures/sources/rva-gov.ts` — move the existing rva.gov scrape logic here. Export it as:
  ```ts
  export const rvaGovSource: ClosureSource = {
    name: 'rva-gov',
    run: async () => { /* existing logic */ },
  };
  ```
- Create `lib/ingest/closures/registry.ts`:
  ```ts
  import { rvaGovSource } from './sources/rva-gov';
  export interface ClosureSource {
    name: string;
    run: () => Promise<RunResult>;
  }
  export const closureSources: ClosureSource[] = [rvaGovSource];
  // Sub-goals 59 and 60 add entries here.
  ```
- Create `lib/ingest/closures/run-all.ts`:
  ```ts
  export async function runAllClosureSources(): Promise<RunResult> {
    let totalRows = 0;
    const errors: string[] = [];
    for (const source of closureSources) {
      const result = await withIngestionRun(`closures:${source.name}`, source.run);
      totalRows += result.rowsWritten;
      if (!result.ok && result.error) errors.push(`${source.name}: ${result.error}`);
    }
    return { ok: errors.length === 0, rowsWritten: totalRows, error: errors.join('; ') || undefined };
  }
  ```
  Each source's run is wrapped in its own `withIngestionRun` so individual source failures are logged separately and one source failing doesn't prevent the others from running. The aggregated result is what the outer caller sees.
- Update `app/api/cron/usgs-percentiles/route.ts` (the cron handler that currently invokes `runRvaClosuresIngestion`) to call `runAllClosureSources()` instead.
- Update `app/api/cron/rva-closures/route.ts` — keep it as a manual-trigger endpoint, but call only the rva-gov source via the registry (e.g., `closureSources.find(s => s.name === 'rva-gov')!.run()`). Or rename to `/api/cron/closures` and run all sources from the manual endpoint too — pick the cleaner option during execution.
- Old `lib/ingest/rva-closures.ts` is deleted (`git rm`) — its content has moved to `lib/ingest/closures/sources/rva-gov.ts`. Imports across the codebase updated.

**Success**
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.
- The `usgs-percentiles` cron handler successfully invokes `runAllClosureSources()` and the rva-gov source still runs to completion.
- A draft for the Pipeline Trail closure now exists (if it didn't before).
- Running the manual `/api/cron/rva-closures` endpoint still works (backward compatible).
- `ingestion_runs` now shows `closures:rva-gov` as a discrete row per run (cleaner audit log than the old undifferentiated `rva-closures`).

---

## Sub-goal 59 — Venture Richmond source module

**Why:** Brown's Island is a Venture Richmond project; the closure announcement and ongoing construction updates live there. Adds coverage for future Venture Richmond initiatives affecting riverfront access (they manage several properties).

**Deliverables**
- `lib/ingest/closures/sources/venture-richmond.ts`:
  - Exports `ventureRichmondSource: ClosureSource` matching the registry interface from sub-goal 58.
  - Fetches the `venturerichmond.com/news/` index page using `cheerio`.
  - Identifies news article entries with date metadata.
  - Also fetches `venturerichmond.com/browns-island-improvement-plan/` once to seed Brown's Island closure context; subsequent runs check this URL for content changes (likely milestone updates).
  - Filters posts/updates to ones likely to be access-affecting (keyword match on `closed`, `closure`, `construction`, `access`, location names matching our 9 access points).
  - For each match: creates a draft `location_status` row with `state='draft'`, `source='Venture Richmond — ' + page_title`, `source_url`, `reason=<excerpt>`, `kind=NULL` (admin sets it on approval).
  - Uses the same content-hash dedup as sub-goal 45 so re-runs without upstream changes produce 0 new drafts.
  - Polite scraping: `User-Agent: rva-james-bot (https://rvajames.org)` via `BOT_USER_AGENT` from `lib/ingest/user-agent.ts`, ≥1s between fetches, respect robots.txt.
- Register in `lib/ingest/closures/registry.ts`:
  ```ts
  export const closureSources: ClosureSource[] = [rvaGovSource, ventureRichmondSource];
  ```
- **No new cron route. No `wrangler.jsonc` changes.** Inherits the daily 03:00 UTC schedule via the registry.
- Check robots.txt at scrape time. If disallowed, halt the source's `run()` returning `{ ok: false, rowsWritten: 0, error: 'robots.txt disallows access' }` so the other sources still run.

**Success**
- First successful run of the closures cron produces ≥1 draft from Venture Richmond (the current Brown's Island closure should match keywords).
- Re-running same day produces 0 new drafts (dedup proven).
- `ingestion_runs` shows a discrete `closures:venture-richmond` row per run, separate from `closures:rva-gov`.
- Pipeline still passes type/lint/build.

---

## Sub-goal 60 — Friends of James River Park source module

**Why:** Independent community-partner perspective on park-wide closures. Catches things the city's own announcements may not, and surfaces alternative-access guidance from a trusted local source.

**Deliverables**
- `lib/ingest/closures/sources/jrps.ts`:
  - Exports `jrpsSource: ClosureSource` matching the registry interface from sub-goal 58.
  - Investigation step at the top: identify the news/updates index URL on jamesriverpark.org. Likely candidates: `/news/`, `/blog/`, or the home page's "latest" section. Document the actual URL used in the source file's top-of-file comment.
  - The site's article URLs follow `/YYYY/MM/DD/slug/` — date-based parsing aids dedup.
  - Same scrape pattern as sub-goals 58/59: cheerio, keyword filter, draft `location_status` rows.
  - Map article titles/content to our 9 access points (10 after sub-goal 61) where possible. Articles about closures NOT mapping to any known location are skipped (logged for awareness, no draft).
  - Honor JSON-LD where present — the article schema includes `datePublished` and `headline` which simplify parsing.
- Register in `lib/ingest/closures/registry.ts`:
  ```ts
  export const closureSources: ClosureSource[] = [rvaGovSource, ventureRichmondSource, jrpsSource];
  ```
- **No new cron route. No `wrangler.jsonc` changes.**
- robots.txt handling identical to sub-goal 59.

**Success**
- First successful run produces ≥1 draft (the Pipeline Trail article and possibly recent park-wide updates).
- Re-running same day produces 0 new drafts.
- `ingestion_runs` shows a discrete `closures:jrps` row per run.
- Drafts include enough metadata (`source_url`, `reason` excerpt, datePublished) for admin to approve confidently.

---

## Sub-goal 61 — Add Pipeline Trail as a 10th location

**Why:** Pipeline Trail is a notable Richmond riverfront landmark that families may hear about and look for in the app. Adding it (with permanent `closed_indefinite` status) provides authoritative "here's why it's closed, here's where to go instead" guidance without inventing new schema.

**Deliverables**
- `supabase/migrations/0010_pipeline_trail_location.sql`:
  - Insert a new `locations` row: `slug='pipeline-trail'`, `name='Pipeline Trail'`, lat/lng (approximate; near 14th Street and the floodwall), `kind='access_point'`, `tags=['closed', 'historical']` (or similar).
  - Insert a permanent `location_status` row with `kind='closed_indefinite'`, `state='active'`, `affects='Entire trail'`, `reason='Closed by City of Richmond DPU since September 13, 2024 due to safety concerns following sewage-pipe failure. Closure expected to remain in effect pending infrastructure decisions.'`, `source='RVA.gov DPU + Friends of James River Park'`, `source_url='https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-closure-update'`, `effective_from='2024-09-13'`, `effective_to=NULL`, `next_review_at='2027-01-01'` (annual review).
- Update the cached AI system prompt (`lib/ai/system-prompt.ts`) location encyclopedia to include Pipeline Trail with its permanent closure context, so the AI never recommends visiting it and can explain the closure when asked.
- Activity matrix: no activities associated with `pipeline-trail` (or all `deny` since the location is closed).
- Add 2–3 default `location_resources` entries linking to: rva.gov closure update, jamesriverpark.org explainer, the FAQ page.
- Surface in the UI: location card on `/` renders with the existing `closed` treatment from sub-goal 46. Detail page `/locations/pipeline-trail` shows the banner with source attribution.

**Success**
- `select count(*) from locations` = 10 (was 9).
- `/locations/pipeline-trail` renders with the closure banner; activity matrix shows all activities denied.
- Homepage location card grid still sorts cleanly (closed locations grouped per sub-goal 46).
- The AI metro summary's `best_bets_today` excludes Pipeline Trail.
- Lighthouse mobile still 100/100/100/100.

---

## Sub-goal 62 — Backfill known closures via admin

**Why:** The scrapes from 59 and 60 will create drafts on their next runs, but the user can land both closures immediately via the admin UI without waiting.

**Deliverables**
- Admin manually creates two `location_status` rows via `/admin/closures/new`:
  - **Brown's Island construction:** `location_id=<browns-island>`, `kind='closed'`, `affects='Entire island'`, `reason='Closed for $30M improvement project. Reopens for Richmond Folk Festival October 9-11, 2026. Full completion early 2027.'`, `source='Venture Richmond Brown\'s Island Improvement Plan'`, `source_url='https://venturerichmond.com/browns-island-improvement-plan/'`, `effective_from='2025-11-17'`, `effective_to='2026-10-09'`, `next_review_at='2026-09-01'`.
  - **Pipeline Trail closure** (only if sub-goal 61's permanent status row isn't already in place via the migration).
- No code changes — this is a 5-minute manual entry pass, documented here so it isn't forgotten.

**Success**
- `/` immediately shows Brown's Island with the closed treatment.
- `/locations/browns-island` renders the construction banner with the Venture Richmond source link.
- AI metro summary next regenerated excludes Brown's Island from `best_bets_today` and references the closure.

---

## Execution rules for the agent

- Run 58 → 59 → 60 → 61 → 62 in order.
- **Sub-goal 58 is the foundation refactor** — sub-goals 59 and 60 are just "add a module + register it." The refactor in 58 is the larger piece of work; 59/60 are short.
- **After sub-goal 58:** stop and report whether the rva.gov scrape already covered the Pipeline announcement AND whether the registry refactor passes regression (`closures:rva-gov` still works end-to-end).
- For Venture Richmond and jamesriverpark.org: **check robots.txt at scrape time**. If either site disallows automated access, the source's `run()` returns an error and the other sources continue. Do not bypass robots.txt.
- **Polite scraping discipline:** custom `User-Agent: rva-james (<contact>)`, ≥1s between requests, no parallel page fetches across sources (the registry runs them sequentially anyway).
- **No new cron triggers, no `wrangler.jsonc` changes.** All new sources piggyback on the existing `usgs-percentiles` daily 03:00 UTC cron via the registry.
- All new drafts go through the existing admin review queue (sub-goal 45's pattern). Never auto-approve.
- Use `git` for all changes; commit per sub-goal.
- Single deploy at the end of the round.

## Critical files

- `lib/ingest/closures/sources/rva-gov.ts` — sub-goal 58 (moved from `lib/ingest/rva-closures.ts`)
- `lib/ingest/closures/sources/venture-richmond.ts` — sub-goal 59 (new)
- `lib/ingest/closures/sources/jrps.ts` — sub-goal 60 (new)
- `lib/ingest/closures/registry.ts` — sub-goal 58 (new; sub-goals 59 and 60 add entries)
- `lib/ingest/closures/run-all.ts` — sub-goal 58 (new)
- `lib/ingest/rva-closures.ts` — **DELETED** in sub-goal 58 (`git rm`)
- `app/api/cron/usgs-percentiles/route.ts` — sub-goal 58 (calls `runAllClosureSources()` now)
- `app/api/cron/rva-closures/route.ts` — sub-goal 58 (becomes a manual-trigger endpoint that runs only the rva-gov source via the registry; or rename to `/api/cron/closures`)
- `supabase/migrations/0010_pipeline_trail_location.sql` — sub-goal 61 (new)
- `lib/ai/system-prompt.ts` — sub-goal 61 (add Pipeline Trail to location encyclopedia)
- `/admin/closures/new` — sub-goal 62 (manual entry, no code change)

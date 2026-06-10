# Security Audit — rvajames.org (2026-06-09)

Source: full review of the request surface (public API routes, cron endpoints,
admin), the Claude integration (`lib/ai/*`), and the Supabase/Cloudflare posture.
RLS policies verified directly against production via the `agent_reader`
SELECT-only role. This document is the backlog-informing report — each work item
below is written to be lifted into a Jira/issue with minimal rewriting.

## What's already solid (no action)

- **RLS enabled on all 13 public tables.** anon = SELECT-only, service_role = ALL.
  No anon write path exists. Verified against prod.
- **Secret hygiene.** `.env*` and `.dev.vars` are gitignored; only `.example`
  files are tracked. The committed Supabase anon key in `wrangler.jsonc` is the
  public key by design and is protected by RLS.
- **SSRF guard.** `global_fetch_strictly_public` is set in `wrangler.jsonc`, so
  Worker `fetch()` cannot reach internal/private addresses.
- **Input validation.** Both public routes validate with Zod + slug regex +
  `isInWindow`, which is what keeps the AI cache key space bounded (see SEC-3).
- **Transport/headers.** HSTS, CSP (enforced), `nosniff`, `frame-ancestors 'none'`
  all present via `middleware.ts`.
- **`*.workers.dev` disabled (done 2026-06-09).** Closes the most likely direct
  Worker-origin bypass for admin auth. SEC-1 hardens what remains.

## Decisions captured this session

| Finding | Decision |
|---|---|
| Admin header trust (SEC-1) | Harden — disabled workers.dev; now validate the Access JWT |
| No rate limiting (SEC-2) | Implement |
| AI worst-case cost (SEC-3) | Implement |
| Speculation-rules XSS (SEC-4) | Implement |
| anon read disclosure (SEC-5) | Implement, low priority |
| Cron-secret timing comparison | **Accepted risk** — secret stored securely; not actioning |

---

## SEC-1 — Validate the Cloudflare Access JWT; stop trusting the email header alone
**Priority: High**

### Problem
`lib/admin/auth.ts` authorizes admins by reading the `cf-access-authenticated-user-email`
header and checking it against `ALLOWED_ADMIN_EMAILS`. The signed
`Cf-Access-Jwt-Assertion` token is never validated. The email header is plaintext
and trivially spoofable by anything that can reach the Worker origin *without*
passing through Access. Once past `requireAdminEmail()`, the admin server actions
in `app/admin/closures/actions.ts` run with the **service role** (RLS-exempt full
read/write). Impact of a bypass = arbitrary closure create/update/delete and any
`location_status` write.

Disabling `*.workers.dev` (done) removes the most common bypass route, but
defense-in-depth requires the Worker itself to verify the token rather than trust
an edge that could be misconfigured in the future.

### Cloudflare Access hardening — evaluation
Two layers: validate the token in-app, and tighten the Access configuration.

**A. In-Worker JWT validation (the core fix).** On every `/admin/*` request:
1. Read the JWT from the `Cf-Access-Jwt-Assertion` header (or the `CF_Authorization`
   cookie).
2. Verify the signature against the team JWKS at
   `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/certs` (cache the keys;
   they rotate). `jose` works in the Workers runtime.
3. Enforce claims: `aud` equals the Access **Application Audience (AUD) tag**,
   `iss` equals `https://<team-name>.cloudflareaccess.com`, and `exp`/`nbf` are valid.
4. Derive the admin email from the **verified** token (`identity` / `email` claim),
   then apply the existing `ALLOWED_ADMIN_EMAILS` allowlist on top.

This makes a spoofed header useless even if a future origin route escapes Access,
because an attacker cannot forge a signature over the AUD tag.

**B. Access configuration review (operational checklist, no code):**
- Confirm the Access **application path** covers the apex + every subdomain that
  can route to the Worker — not just `/admin`.
- Access **policy** should be an explicit allow on specific emails/IdP group, not
  "any authenticated user."
- Require the intended **identity provider** and enforce **MFA** in the policy.
- Set a **short session duration** for the admin app.
- Add **service tokens** if any automation needs admin endpoints (separate from
  CRON_SECRET).
- Enable **Access audit logs** and spot-check them after rollout.
- Optionally add a **WAF custom rule**: block requests to `/admin/*` that lack a
  valid `Cf-Access-Jwt-Assertion`, as a belt-and-suspenders edge filter.

### Acceptance criteria
- A request to `/admin/*` carrying only a spoofed `cf-access-authenticated-user-email`
  header (no valid JWT) is rejected with 403.
- A request with a valid Access JWT whose email is in the allowlist succeeds.
- A request with a valid JWT but a non-allowlisted email is rejected.
- Local-dev path (no Access edge) still documented/working per DEPLOYMENT.md.

### Notes / effort
Medium. New helper (`verifyAccessJwt`) in `lib/admin/auth.ts` + JWKS caching.
`jose` is the only new dependency. Keep the allowlist check as the second gate.

---

## SEC-2 — Add rate limiting to the public API and cron routes
**Priority: High**

### Problem
No rate limiting, Turnstile, or per-IP throttle exists anywhere (confirmed: zero
matches for any rate-limit pattern in the codebase). Consequences:
- Every request is a billable Worker invocation. A trivial flood exhausts the
  free-tier 100k/day quota (DoS for real users) or runs up a Workers Paid bill.
- Each `/api/metro-summary` and `/api/location-interpretation` hit runs the full
  deterministic Supabase query set even on cache hits → sustained DB read pressure.
- Cron routes (`/api/cron/*`) are publicly reachable; even a 401 response costs a
  Worker invocation, so they're floodable too.

### Recommendation
Prefer the **Cloudflare-edge** layer so junk traffic dies before the Worker runs:
- **Option 1 (simplest):** Cloudflare **Rate Limiting Rules (WAF)** scoped to
  `/api/*` by client IP. No code; works at the edge. Note free-plan rule-count
  limits — may need to consolidate into one rule.
- **Option 2 (precise):** Workers **Rate Limiting binding** (or a Durable Object
  keyed by IP+path) for per-route limits inside the Worker. More control, slightly
  more cost since the Worker still starts.
- Apply distinct buckets: a modest limit on the public AI routes (e.g. tens/min/IP)
  and a tight limit on `/api/cron/*` (these should almost never be hit by the public).
- Return `429` with `Retry-After`.

### Acceptance criteria
- Sustained requests beyond the threshold from one IP receive `429`.
- Legitimate single-user navigation (chip clicks across locations/dates/ages) is
  never throttled under normal use.
- Cron endpoints remain reachable by the scheduled trigger (verify the trigger
  path is not caught by the IP rule, or relies on CRON_SECRET + a generous limit).

### Notes / effort
Low-medium. Option 1 is config-only. Pair with SEC-3 — rate limiting alone caps
request volume; SEC-3 caps the cost *per* allowed request.

---

## SEC-3 — Bound AI-generation worst-case cost (single-flight + ceiling + key quantization)
**Priority: High**

### Problem
Cost is bounded per cycle but an attacker can drive it to the ceiling repeatedly.
The lazy-generation model (a hard project constraint — no pre-generation cron) means
public requests can trigger Anthropic calls. Three compounding issues:

1. **Cache-miss stampede (was #4).** On a miss there is no in-flight lock. The
   `UNIQUE`-conflict handling in `lib/ai/get-or-generate.ts` dedups the *DB write*
   but not the *Anthropic call* — N concurrent requests for the same uncached
   `(date, age[, location])` each call `ai.messages.create` before the first INSERT
   lands. 100 concurrent requests = ~100 real API calls, 1 row persisted. Sharpest
   amplifier.
2. **Sensor-driven cache churn (was #3).** `computeMetroHash`/`computeLocationHash`
   include raw sensor scalars (`gageFt`, `dischargeCfs`, `waterTempF`, …). These
   change every USGS refresh (15 min), so the bounded ~216 combos
   (9 locations × 4 dates × 6 ages) become regenerable each cycle — up to
   ~20k generations/day if walked. When a high/extreme advisory is active the model
   escalates Haiku → Sonnet 4.6 (~10× cost/call).
3. **No global spend ceiling.** Nothing caps cumulative daily Anthropic spend.

### Recommendation (three independent, stackable controls)
- **Single-flight lock** (fixes #1). Before calling Anthropic, claim the cache key:
  e.g. insert a sentinel row / take `pg_advisory_xact_lock(hashtext(prompt_hash))`,
  or a short-TTL KV lock. The winner generates; concurrent losers poll for the
  result row (or fall back to stale/deterministic). Only the first miss hits the API.
- **Cache-key quantization** (blunts #2). Round sensor inputs before hashing
  (e.g. `gageFt` to 0.25–0.5 ft, discharge to bands). Safe because the AI only
  *narrates* — deterministic status comes from `lib/safety/rules.ts`, untouched.
  Dramatically cuts regeneration frequency for both real refreshes and attackers.
- **Daily cost circuit breaker** (hard cap). Track cumulative `cost_usd` per UTC day
  (the column already exists). Above a configured ceiling, public routes serve
  stale/deterministic and skip Anthropic entirely until the next day.

### Acceptance criteria
- 50 concurrent requests for one uncached key produce exactly **1** Anthropic call.
- A minor sensor tick (below the quantization step) does **not** bust the cache.
- With the daily ceiling tripped, public routes return 200 from stale/deterministic
  content and make zero Anthropic calls; a log/metric records the trip.
- Deterministic safety status is unchanged by quantization (rules engine unaffected).

### Notes / effort
Medium. Single-flight + ceiling touch `lib/ai/get-or-generate.ts`. Quantization is
a small change in the two `compute*Hash` functions (bump `PROMPT_VERSION` to orphan
old rows). Honors the "lazy AI only, no pre-generation cron" constraint.

---

## SEC-4 — Constrain `location_slug` before it enters the speculation-rules `<script>`
**Priority: Medium**

### Problem
`components/metro/MetroSummaryPanel.tsx` (~line 208) serializes
`summary.best_bets_today[].location_slug` via `JSON.stringify` into an inline
`<script type="speculationrules" dangerouslySetInnerHTML>`. The schema types the
field as bare `z.string()` (`lib/ai/prompts/summarize-metro.ts:35`) with no regex,
and `JSON.stringify` does not escape `/`. A slug containing `</script>…` would break
out of the script context → stored XSS. The source is Claude output, which ingests
scraped advisory headlines and admin/scraped closure reasons — a
prompt-injection → XSS chain. Low probability, cheap fix. The permissive
`script-src 'unsafe-inline'` CSP is what would let such a payload execute.

### Recommendation
Constrain `location_slug` in the schema with the same pattern the API route already
enforces: `z.string().regex(/^[a-z0-9-]{2,64}$/)`. Defense-in-depth: also drop any
best-bet whose slug doesn't match a known location before rendering, and/or escape
`<` when serializing into the script tag.

### Acceptance criteria
- A best-bet with a non-slug value is rejected by the schema (regenerates) or
  filtered before render — never reaches the inline script.
- Existing valid slugs render the speculation-rules script unchanged.

### Notes / effort
Low. One regex in the schema + an optional render-time filter.

---

## SEC-5 — Tighten anon read policies on operational tables
**Priority: Low**

### Problem
Verified in prod: `ai_interpretations`, `metro_summaries`, and `ingestion_runs`
have `anon_read` policies with `USING (true)`. Anyone with the public anon key can
dump all cached AI text plus per-row `cost_usd`/token counts and the full
scrape-run history (timings, error strings). No secrets exposed, but `cost_usd`
per row directly aids tuning the SEC-3 cost attacks, and `ingestion_runs` errors
can leak internal detail.

### Recommendation
The app reads these tables server-side with the **service** client, so anon read
isn't required for app function. Restrict to service-role-only reads (drop or scope
the `anon_read` policies). If any of these are read client-side anywhere, confirm
first and scope the policy (e.g. expose only display columns, not `cost_usd`/
`tokens_*`/`error`). Follow the project's migration handoff: write the migration,
verify locally, commit, then a human applies it to prod.

### Acceptance criteria
- anon key can no longer SELECT `ai_interpretations`, `metro_summaries`,
  `ingestion_runs` (or only non-sensitive columns, if a client read exists).
- App pages and the two public API routes still function (they use the service
  client server-side).

### Notes / effort
Low. RLS policy migration only. Requires the migration handoff (human applies to
prod).

---

## Accepted risk (documented, not actioned)

**Cron-secret timing comparison.** `guardCronSecret` in `lib/ingest/run.ts` uses a
non-constant-time `provided !== secret` comparison. Owner accepts this risk
(secret stored securely; network timing noise makes the attack impractical). If
revisited later, the fix is `crypto.timingSafeEqual` over equal-length buffers.

---

## Suggested backlog order

1. **SEC-2** rate limiting (edge config, fastest risk reduction).
2. **SEC-3** AI worst-case controls (single-flight first, then ceiling, then
   quantization).
3. **SEC-1** Access JWT validation (depends on confirming the Access AUD tag +
   team name).
4. **SEC-4** slug regex (quick, can ride along with any AI-schema change).
5. **SEC-5** anon read tightening (migration handoff; low priority).

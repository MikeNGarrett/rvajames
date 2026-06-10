# Edge hardening runbook — security audit close-out (2026-06-10)

The last open items from `docs/security-audit-2026-06-09.md` (SEC-1 part B +
SEC-2 option 1). All are Cloudflare **dashboard** config — no code, human
executes. Everything code-actionable from the audit shipped and was verified
live on 2026-06-10 (SEC-1..5 + the 403 follow-up + the workers_dev pin).

Each step carries a verdict relative to what the audit originally suggested:

- **✅ DO** — do as the audit suggested.
- **⚠️ MODIFIED** — the audit's suggestion needed correction; do the revised
  version here instead.
- **❌ SKIP** — recommend not doing it; reason given inline.

## Verdict summary

| # | Step | Verdict |
|---|---|---|
| 1a | Access policy: explicit email allowlist | ✅ DO |
| 1b | Access: pin to one identity provider | ✅ DO |
| 1c | Access: "Authentication Method = MFA" require-rule | ❌ SKIP (enforce 2FA at the IdP instead) |
| 1d | Access: session duration → 1 hour | ✅ DO |
| 1e | Access: audit-log spot check | ✅ DO |
| 2 | WAF rule blocking /admin without the Access JWT | ❌ SKIP (breaks login; header not visible at WAF phase) — ⚠️ MODIFIED variant available if an edge layer is wanted |
| 3 | Edge rate-limiting rule on /api/* | ✅ DO |
| 4 | Post-config verification | ✅ DO |

State verified before writing this:
- `*.workers.dev` and preview URLs: disabled, pinned in `wrangler.jsonc`.
- `www.rvajames.org`: no DNS record (NXDOMAIN) — no Access-coverage gap.
- Access app exists for `rvajames.org/admin` (team domain
  `holy-voice-2683.cloudflareaccess.com`, observed in the live 302).
- In-Worker JWT verification active (spoofed-header probes denied).

---

## 1. Access application review (Zero Trust → Access → Applications → RVA James Admin)

### 1a. Policy: explicit email allowlist — ✅ DO

One **Allow** policy with an explicit **Emails** include list that exactly
matches `ALLOWED_ADMIN_EMAILS`. Remove any "any authenticated user" /
"everyone on team domain" include.

### 1b. Pin the identity provider — ✅ DO

In the app's Authentication tab, untick every IdP except the one you
actually use.

### 1c. "Authentication Method = MFA" require-rule — ❌ SKIP

The audit's MFA item is better satisfied at the IdP. Do not add the
Cloudflare require-rule:

- If you sign in with the email one-time-PIN, OTP is single-factor — the
  rule would block **all** logins.
- If you sign in with Google, Google does not reliably pass the `amr` claim
  the rule keys on — same lockout risk.

Instead: enforce 2FA on the IdP account itself (e.g. Google 2-Step
Verification). Revisit the require-rule only if you move to an IdP that
documents AMR support.

### 1d. Session duration → 1 hour — ✅ DO

App-level session: **1 hour** (drop-down on the app's Overview tab). Admin
use here is occasional; re-auth cost is low, stolen-cookie window shrinks 24×.

### 1e. Audit logs — ✅ DO

Zero Trust → Logs → Access. Nothing to enable — verify your own logins
appear, then spot-check for unfamiliar identities/IPs occasionally.

## 2. WAF rule for /admin — ❌ SKIP (audit suggestion is a lockout footgun)

The audit suggested a custom rule blocking `/admin/*` requests lacking
`Cf-Access-Jwt-Assertion`. **Do not implement it as written.** Verified
against the ruleset-engine phase list: `http_request_firewall_custom` runs
**before** Access, so:

1. A first visit (no session yet) carries no JWT — the rule would block the
   request before Access can issue the login redirect. You'd lock yourself out
   of the login flow.
2. The `Cf-Access-Jwt-Assertion` header is attached **by Access**, i.e. after
   the WAF phase — so even authenticated requests would look header-less to
   the rule and be blocked.

The in-Worker JWT verification (SEC-1, deployed) already covers this threat
strictly better — skipping costs nothing.

### ⚠️ MODIFIED variant (optional, only if you want an edge layer anyway)

The only safe shape keys on the browser cookie and exempts the login flow's
GETs:

```
Expression: starts_with(http.request.uri.path, "/admin")
            and http.request.method ne "GET"
            and not (http.cookie contains "CF_Authorization=")
Action: Block
```

(Authenticated server-action POSTs always carry the `CF_Authorization`
cookie; unauthenticated POST floods die at the edge. GETs fall through to
Access → login works.) If you add this, the browser login check in step 4
is mandatory.

## 3. Edge rate limiting on /api/* — ✅ DO (SEC-2 option 1, pre-Worker layer)

The in-Worker binding (SEC-2, live) returns 429s but still bills a Worker
invocation per request. One zone-level rule kills floods before the Worker
runs. Security → WAF → Rate limiting rules → Create:

```
Rule name:   api-flood
Expression:  starts_with(http.request.uri.path, "/api/")
Counting:    requests by same IP
Threshold:   50 requests / 10 seconds        (free plan fixes the 10s period)
Action:      Block (free plan: 10s mitigation timeout)
```

- Normal use peaks at a few requests/second briefly — 50/10s never touches it.
- The in-Worker limiter (60/min per route) remains the precise layer beneath.
- Cron triggers are unaffected: the `scheduled()` handler dispatches inside
  the Worker process and never traverses the zone edge.

## 4. Verify after configuring — ✅ DO

```bash
# Login flow still works (the critical regression check for any /admin rule):
#   open https://rvajames.org/admin/closures in a browser, complete login.

# Edge rate limit (expect 429/block page well before 100):
for i in $(seq 1 100); do curl -s -o /dev/null -w "%{http_code} " \
  "https://rvajames.org/api/metro-summary?date=$(date +%F)&age=6-9"; done; echo

# Access logs: Zero Trust → Logs → Access — confirm your login event.
```

After this, every item from the 2026-06-09 audit is closed (SEC-1..5
implemented + deployed; cron-secret timing compare remains an accepted risk).

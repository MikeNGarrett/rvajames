# Spec-Website Audit — Action Items

Backlog generated from `.audit/runs/2026-05-31T02-31-02-Z/report.md` (spec-check
against [specification.website](https://specification.website/) on 2026-05-31).

Scope: **44 pass · 7 fail · 48 manual-review · 7 N/A · 10 deprioritised.**
The 7 fails are the actionable surface. Manual-review items are out of scope
for this round (most are organisational/operational decisions, not code
changes). The contradiction at the bottom is its own discovery item.

---

## Sub-goal A — HSTS header  · 🔴 HIGH

**Issue:** `Strict-Transport-Security` header absent.
**Fix:** Add to `middleware.ts` (or the next.config headers slot):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Optionally add `; preload` and submit to the HSTS preload list once the
header has been live for at least 30 days. Don't preload on first deploy.

**Verification:** `curl -sI https://rvajames.org/ | grep -i strict-transport`
should return the header. Spec-check re-run flips to ✅.

---

## Sub-goal B — Graduate CSP from Report-Only to enforced  · 🟡 MEDIUM

**Issue:** `Content-Security-Policy` header absent — only the Report-Only
variant is shipped (deployed sub-goal 79, commit `0723474`).

**Context:** The Report-Only policy has been live for weeks without violation
reports. Per the rollout plan in `docs/feedback-round-1-plan.md`, the goal
was to graduate to enforced once monitoring confirmed no breakage. Now is
that moment.

**Fix:** In `middleware.ts`, change `Content-Security-Policy-Report-Only`
to `Content-Security-Policy`. Keep the policy exactly as-is. Optionally
keep both headers for one deploy cycle as a safety net.

**Verification:** `curl -sI https://rvajames.org/ | grep -i content-security`
returns the enforced header. Open `/` in DevTools, check Console for CSP
violations — must be zero. Spec-check re-run flips to ✅.

---

## Sub-goal C — Static `/.well-known/security.txt`  · 🟡 MEDIUM

**Issue:** `/.well-known/security.txt` returns 404.

**Fix:** Add `public/.well-known/security.txt` per RFC 9116:

```
Contact: https://github.com/MikeNGarrett/rvajames/security/advisories/new
Expires: 2027-05-31T00:00:00.000Z
Preferred-Languages: en
Canonical: https://rvajames.org/.well-known/security.txt
Policy: https://github.com/MikeNGarrett/rvajames/blob/main/SECURITY.md
```

Mirrors `SECURITY.md`'s existing GitHub-private-advisories flow.

**Verification:** `curl https://rvajames.org/.well-known/security.txt` returns
the file. Spec-check flips to ✅.

---

## Sub-goal D — `/llms.txt`  · 🟡 MEDIUM

**Issue:** `/llms.txt` returns 404.

**Fix:** Add `public/llms.txt` per llmstxt.org. Should describe what RVA James
is, the data sources, the AI involvement, and link to the cached system
prompt's foundational claims.

Initial content (draft — refine in execution):

```
# RVA James

> Family-focused James River conditions dashboard for Richmond, VA.
> Consolidates USGS gage, NWS weather, Richmond DPU CSO advisories,
> and James River Association water quality into kid-safe guidance
> tailored to a family's youngest child.

## What this site provides

- Current river conditions (gage height, discharge, water temp)
- Active advisories (flood warnings, CSO events, bacterial)
- AI-interpreted recommendations per access point by age bucket
- Trip prep checklists

## Data sources

- USGS Water Services (gage 02037500)
- NWS hourly forecast + flood alerts
- Richmond DPU CSO event tracking (EmNet integration)
- James River Association water quality samples

## AI

Claude Haiku 4.5 / Sonnet 4.6 interpret deterministic sensor data into
plain-language guidance. Never used for fetching, only interpretation.

## Useful endpoints

- /sitemap.xml
- /safety
- /locations/[slug]
```

This also closes sub-goal F (machine-readable formats) — llms.txt is one
of the formats the spec wants.

**Verification:** `curl https://rvajames.org/llms.txt` returns the file.
Spec-check flips to ✅ on both `/llms.txt` and "Machine-readable formats."

---

## Sub-goal E — JSON-LD structured data (Organization + WebSite)  · 🟡 MEDIUM

**Issue:** No JSON-LD on home page. Fails THREE spec items at once:
- SEO → Structured data
- Agent-readiness → Structured data for agents
- Agent-readiness → Machine-readable formats (overlaps with llms.txt above)

**Fix:** Add JSON-LD `<script type="application/ld+json">` to `app/layout.tsx`
so every page inherits it. Minimum viable shape:

```jsonc
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://rvajames.org/#org",
      "name": "RVA James",
      "url": "https://rvajames.org/",
      "logo": "https://rvajames.org/icon"
    },
    {
      "@type": "WebSite",
      "@id": "https://rvajames.org/#site",
      "url": "https://rvajames.org/",
      "name": "RVA James — James River conditions for Richmond families",
      "publisher": { "@id": "https://rvajames.org/#org" }
    }
  ]
}
```

Per-location pages can later add a `Place` schema layered on the same graph.

**Verification:** `curl -s https://rvajames.org/ | grep 'application/ld+json'`
returns markup. Validate via [validator.schema.org](https://validator.schema.org/).
Spec-check flips to ✅ on three items.

---

## Sub-goal F — Investigate hreflang contradiction  · ⚠ INVESTIGATION

**Issue:** Profile declares `localeScope=single` (English-only), but
Screaming Frog found 13 hreflang entries. Either the profile is wrong or
the markup is wrong.

**Almost certainly the markup is wrong** — RVA James is Richmond-specific,
no international audience. The hreflang entries are likely from a Next.js
default or a copy-paste mistake.

**Fix:** Grep the codebase for `hreflang`. Remove any tags found. Verify
the Screaming Frog re-crawl no longer surfaces them.

```bash
grep -rn "hreflang" --include="*.tsx" --include="*.ts" --include="*.html" \
  -- app/ components/ public/
```

If no source code matches, the tags might come from a `<link rel="alternate">`
emitted by Next.js metadata or from sitemap.xml. Check `app/sitemap.ts` and
`app/layout.tsx` metadata.

**Verification:** Re-run Screaming Frog (or `curl | grep hreflang`) — zero
entries. Spec-check re-run resolves the contradiction.

---

## Sequencing

A → B → C → D → E → F. None of them block each other strictly, but:
- A is highest priority (security header)
- B + C + D + E are all small-scope and can land in one deploy
- F is investigation-first, may surface its own follow-ups

Single-round candidate. Estimated complexity: 1 session if all goes well.

## Out of scope this round

The 48 "manual review" items are mostly operational decisions (privacy
policy, monitoring/uptime, custom error pages, cookie consent, etc.).
Many already have informal solutions (the DisclaimerFooter covers some
of the privacy/safety guidance need). Triage in a separate /design pass
if/when prioritised.

The N/A items are correctly excluded (auth flows, i18n) per the site
profile and don't need action.

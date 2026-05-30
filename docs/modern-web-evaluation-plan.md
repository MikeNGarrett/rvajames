# RVA James — Modern Web Evaluation Plan

## Context

Production app at `https://rvajames.org` (and `https://rva-james.mike-garrett.workers.dev`). Next.js 15 App Router on Cloudflare Workers via `@opennextjs/cloudflare`, Tailwind v4, lazy AI generation via Anthropic, Supabase backend. Mobile-first by spec.

Recent shipped work:
- Feedback Round 1: deterministic rules engine, lazy AI generation, metro panel, deterministic location cards, resource links.
- One open data bug (downriver tidal gauge missing) — out of scope for this evaluation; that's its own fix.
- A second round (rapids class + homepage activity grid) is planned but not yet executed.

Known production state we want to evaluate against:
- Current Lighthouse mobile LCP ≈ 2.2s (passes the 2.5s budget but isn't optimized).
- LCP element has never been formally identified.
- INP/CLS have never been audited.
- Accessibility has only been checked at the brand-tokens level (Goal 3), not against real component compositions.
- No SEO/meta hygiene review since Goal 18 baselines.
- The lazy-AI Suspense pattern is in production but its perceived-performance impact has not been studied.

This plan uses the newly-installed `modern-web-guidance` skill (sourced from `GoogleChrome/modern-web-guidance`) to produce a prioritized findings document that drives a follow-on round of work.

## Goals of this evaluation

1. **Verify or correct the assumed performance posture.** Identify the actual LCP element, measure INP under interaction (date/age form submit triggers AI generation — that's the worst-case INP path), measure CLS during streaming-in of the metro AI summary.
2. **Catch outdated patterns.** Find places where the codebase reaches for older patterns when a modern equivalent would be simpler, cheaper, or more accessible. The mobile-first dashboard is fertile ground for modern CSS (container queries, `:has()`, `color-mix()`), View Transitions, Speculation Rules, modern image/font loading.
3. **Accessibility under real composition.** Tokens were checked in isolation. Composed pages (homepage, location detail, status, safety, brand) need their own audit — semantic structure, focus management, screen reader flow, color contrast under semantic-color states (safe/caution/danger pills).
4. **Network and runtime hygiene at the edge.** Modern resource hints, security headers (CSP, COOP, COEP), modern image/font formats, caching headers from the Worker. OpenNext defaults aren't always optimal.
5. **Output a prioritized findings document** that maps cleanly to follow-on sub-goals in the existing plan-then-goal workflow.

## Evaluation scope (and explicit non-scope)

**In scope**
- Homepage (`/`)
- One representative location page (`/locations/belle-isle`)
- `/safety`
- `/status`
- `/brand` (only as a dev-mode reference — production users don't see it; check that it's gated as planned)

**Out of scope**
- The downriver tidal data bug (separate workstream).
- The rapids/activity grid redesign (separate planned round; this evaluation runs against the current production state, not the planned redesign).
- Backend changes (Supabase schema, ingest jobs, AI prompt engineering) unless an evaluation finding directly implicates them.

## How the executing agent should use `modern-web-guidance`

The skill is a `npx`-invoked CLI search/retrieve tool installed locally per `skills-lock.json` — not a Claude Code session skill loaded via the Skill tool. It's invoked directly with Bash:

```bash
# Action-oriented search returning JSON with id, description, category, similarity
npx -y modern-web-guidance@latest search "<query>"

# Optional: browse the full guide catalog if search returns vague matches
npx -y modern-web-guidance@latest list

# Retrieve the full markdown guide(s) for one or more ids (comma-separated)
npx -y modern-web-guidance@latest retrieve "<id>[,<id2>,...]"
```

It returns curated, current Chrome team guidance — adoption thresholds for newer features (View Transitions, Speculation Rules, container queries, `:has()`, etc.), anti-pattern detection criteria, and pointers to web.dev articles. The catalog spans accessibility, CSS layout, forms, performance, built-in AI, scroll/motion, etc.

**Use the skill to bias judgment toward current best-practice, not to replace measurement.** Pair every recommendation with a measurement from one of:
- `web-perf` skill (Chrome DevTools MCP) for CWV measurement.
- Lighthouse mobile via `lhci` against the live URL.
- `wrangler tail rva-james` for runtime errors during interaction.
- Manual DevTools inspection of the live site.

## Step-by-step plan

### Step 1 — Load skills and baseline the live site
- Load `modern-web-guidance` skill.
- Load `web-perf` skill.
- Run a baseline Lighthouse mobile audit against `https://rvajames.org/` and capture the report URL.
- Record current scores for Performance, Accessibility, Best Practices, SEO. These become the "before" snapshot.

### Step 2 — Performance audit (CWV + supplementary)
For each in-scope URL:
- Measure LCP, INP, CLS, FCP, TBT, Speed Index via the `web-perf` skill against the live site, mobile profile.
- Specifically identify the LCP element on `/`. If it's a text node, note the font-loading path and whether `display: swap` is hurting perceived load. If it's an image (unlikely on this dashboard), note format and sizing.
- Trigger an INP measurement by submitting the date/age filter form on `/`. This is the heavy interaction — it triggers either a cache read or a fresh Anthropic call. Both paths should be measured.
- Measure CLS during the metro summary's streaming-in under Suspense. The skeleton-to-content swap is a high CLS risk.

Apply `modern-web-guidance` to each finding: is the issue addressable with a modern platform feature (Speculation Rules for the location card links, View Transitions for date/age changes, content-visibility for the location grid)? Note candidates without prescribing yet.

### Step 3 — Accessibility audit
- Run axe-core via DevTools Issues panel on each in-scope URL.
- Manually walk each URL with keyboard only — Tab order, focus visibility, escape behavior on the FirstVisitModal.
- Screen reader pass on `/` with VoiceOver (macOS): does the metro AI summary announce when it streams in? Are the status pills on location cards labeled?
- Apply `modern-web-guidance` for modern accessibility patterns (focus-visible polyfilling no longer needed, `<dialog>` element, modern landmark structure).

### Step 4 — Modern CSS / layout audit
- Inspect Tailwind output for places where:
  - `:has()` could replace JS state coupling
  - Container queries could replace duplicated breakpoints
  - `color-mix()` could simplify semantic-color ramps
  - View Transitions API could improve perceived-performance on date/age changes
  - `content-visibility: auto` could defer off-screen location cards
- Apply `modern-web-guidance` adoption thresholds — if Chrome team marks a feature "ready," consider it; if "experimental," note for future.

### Step 5 — Network / runtime hygiene
- Check response headers from the Cloudflare Worker:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - Caching headers (`Cache-Control`, `ETag`)
- Confirm static assets are served with appropriate immutable caching.
- Confirm `next/font` is producing modern formats (woff2) and self-hosting (no external font requests).
- Confirm no third-party requests beyond Supabase and Anthropic (both are server-side from the Worker, should be invisible to the client).
- Apply `modern-web-guidance` for modern security header recommendations (especially CSP — strict-dynamic, nonces if needed for inline scripts emitted by Next).

### Step 6 — Code-side modernity (read-only)
- Read representative files: `app/page.tsx`, `app/locations/[slug]/page.tsx`, `components/metro/MetroSummaryPanel.tsx`, `components/filters/ConditionsForm.tsx`.
- Flag any of these without recommending a change yet:
  - `useEffect` patterns that could be Server Components or `cache()` calls
  - Manual state where `useTransition` / `useDeferredValue` would be cleaner
  - Client components that don't need to be (look for `'use client'` directives on components that could render server-side)
  - Older event-handler patterns (the form may have these)
- Apply `modern-web-guidance` for React 19 / Next 15 App Router idioms.

### Step 7 — Produce the findings document
Output: `docs/modern-web-evaluation-findings.md` in the project repo.

Structure:
```
# RVA James — Modern Web Evaluation Findings

## Summary
- Overall posture (1 paragraph)
- Lighthouse before-snapshot (4 scores)
- Top 3 wins to ship in the next round
- Top 3 follow-up investigations

## Findings (numbered, each as:)
### Finding N — [short title]
- Severity: blocker | high | medium | low | nit
- Scope: which URL(s) / file(s) affected
- Evidence: measurement, screenshot, or code reference
- Modern-web-guidance recommendation (the principle, not the prescription)
- Suggested resolution (a sentence, not a full plan)
- Effort estimate: <1h | 1–4h | 4h–1d | >1d

## Out of scope but noted
- Anything spotted that's worth knowing but not for this round
```

Severity rubric:
- **Blocker**: fails a published web standard, accessibility law minimum, or measurable user harm
- **High**: meaningful CWV regression risk or significant a11y degradation
- **Medium**: modernization opportunity with clear payoff
- **Low**: nice-to-have, modern but not urgent
- **Nit**: stylistic or future-looking

### Step 8 — Triage and propose follow-up
After the findings document lands, group findings into 1–3 candidate follow-up sub-goals (continuing the 29/30/31… numbering of the project's plan series). Each candidate sub-goal should:
- Bundle 3–7 related findings
- Have a clear deliverable list
- Reference the findings by number
- Estimate the cost ceiling impact (any change to Anthropic call shape, Supabase storage, etc.)

Hand the candidate sub-goals back to the user for prioritization before any implementation begins.

## Execution rules for the agent

- This is a **read-only audit**. Do not modify code, components, configs, schema, or content. The only file written is `docs/modern-web-evaluation-findings.md` and the follow-up sub-goal proposals.
- Cite measurements with values, not impressions. "LCP 1,820 ms (within budget)" beats "LCP feels good."
- For every modern-web-guidance recommendation, cite the source the skill points at (web.dev article URL, MDN entry, etc.).
- Limit to ~25 findings total. Pick the highest-leverage. If you find more, list the remainder under "Out of scope but noted."
- If `modern-web-guidance` isn't actually loaded or doesn't behave as expected, stop and report rather than fabricating its guidance.
- Do not run lhci or any tooling against the dev build — only the live production URLs.

## Suggested `/goal` prompt to drive this

```
/goal Execute the plan at docs/modern-web-evaluation-plan.md. This is a READ-ONLY audit — the only file you write is docs/modern-web-evaluation-findings.md plus the candidate sub-goal proposals at the end. Do not modify any source code, configs, schema, or content.

The modern-web-guidance skill is installed locally per skills-lock.json. Invoke it via Bash:
  npx -y modern-web-guidance@latest search "<query>"
  npx -y modern-web-guidance@latest retrieve "<id>[,<id2>,...]"
  npx -y modern-web-guidance@latest list   (only if search returns vague matches)

Run the 8 steps in order against the live production URL (https://rvajames.org). For each candidate finding, run a targeted modern-web-guidance search first, then retrieve the relevant guide(s), then write the finding citing the guide id and any URL the guide points at.

Use the web-perf skill for CWV measurement (LCP element identification, INP under date/age form submit, CLS during metro AI streaming-in). Use Lighthouse mobile via lhci for the baseline snapshot.

Produce the findings document per the schema in step 7. Cap findings at ~25. Severity, scope, evidence, recommendation, effort estimate for each.

After the findings document is committed, propose 1–3 candidate follow-up sub-goals continuing the project's 29/30/31… numbering. Each bundles 3–7 related findings. Do not implement them — hand them back for prioritization.

Working dir: the rva-james repo root
```

## Notes on cross-skill orchestration

The executing agent will likely benefit from loading these in parallel at the top of the session:
- `modern-web-guidance` (primary)
- `web-perf` (measurement)
- `cloudflare` (for header / Worker config context)
- `workers-best-practices` (for Worker-side runtime patterns)

Don't load `code-review` for this — that's a diff-based review skill and there is no diff in scope.

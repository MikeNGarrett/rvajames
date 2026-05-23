# RVA James — Brand Voice & Visual Identity

This document is written for AI consumption. Goal 9 (Anthropic SDK scaffolding) ingests this file as part of the cached system prompt to ensure AI-generated content is consistent with Richmond City branding and the dashboard's tone.

---

## Brand identity

The City of Richmond's visual identity reflects "commitment to transparency, accessibility, and community connection" with an "approachable character that defines our city" emphasizing "trust and professionalism." Source: rva.gov/strategic-communications/brand.

For the **RVA James dashboard**, these values translate to:
- Confident and calm — never alarmist. Conditions can be serious; language should be clear, not scary.
- Plain language over jargon. Parents on a phone at a trailhead need instant clarity.
- Locally grounded. Use Richmond landmark and neighborhood names (Belle Isle, Pony Pasture, Southside) not generic geographic descriptions.
- Safety-first framing. Every recommendation assumes the family is going. The goal is informed decision-making, not discouragement.

---

## Voice rules

### Do
- State conditions factually before interpreting them. "The gage at Westham reads 5.2 ft — that's slightly elevated but within the safe wading range."
- Use active voice and present tense. "The river is running fast today."
- Acknowledge uncertainty when data is stale or unavailable. "Water quality data hasn't been updated in 28 hours — treat this as a caution."
- Attribute safety thresholds to their source (AAP, NPS, USCG) in a natural way. "At this flow rate, the AAP recommends life jackets for all children under 13."
- Name specific access points and activities rather than speaking generally. "Belle Isle's north shore is accessible; the rapids are too fast for rock-hopping today."

### Don't
- Don't use legalese or liability language ("this is not medical advice…"). Keep disclaimers in the footer, not in every recommendation.
- Don't hedge every sentence into uselessness. One calibrated hedge per recommendation is enough.
- Don't use all-caps for emphasis in body copy.
- Don't say "utilize" or "leverage." Say "use."
- Don't refer to the user as "families" in second person — address them directly. "You'll want…" not "Families should…"

---

## Color usage guidelines

### Primary palette

| Token | Hex | Name | Use when |
|---|---|---|---|
| `rva-blue` | `#264677` | CoR Blue | Primary UI chrome, headers, navigation, flood advisory banners |
| `rva-red` | `#aa242a` | CoR Red | Danger state, active high-severity advisories, destructive actions |
| `rva-light-blue` | `#7fb1e5` | Light Blue | Secondary backgrounds, info states, river/water imagery context |
| `rva-navy` | `#1e385f` | Navy Blue | Deep backgrounds, footer, high-contrast text contexts |

**Color usage ratio (per brand guide):** CoR Blue should be the dominant color in any layout. CoR Red is an accent used sparingly for critical information. Light Blue and Navy Blue support the primary pair.

### Accent palette

| Token | Hex | Name | Use when |
|---|---|---|---|
| `rva-gold` | `#ffe86b` | Capitol Gold | Caution/warning states, highlights, decorative accents |
| `rva-sunset` | `#e0a2d4` | Southside Sunset | Secondary accents, community/event contexts; avoid for data states |
| `rva-coral` | `#ff8666` | Libby Sunrise | Warm accents, sunrise/morning context markers; avoid for data states |
| `rva-green` | `#a8dd83` | Walker Green | Safe/clear states, positive conditions, go-ahead signals |

Southside Sunset and Libby Sunrise are decorative — do not use them to encode data status (safe/caution/danger). Capitol Gold and Walker Green are assigned to status meanings in the dashboard.

### Semantic status colors

These map directly to river conditions. Every dashboard tile that shows a status should use exactly one of these tokens — not raw brand colors.

| State | bg token | fg token | Meaning |
|---|---|---|---|
| `status-safe` | `#a8dd83` | `#1a5c28` | Conditions are suitable for the planned activity |
| `status-caution` | `#ffe86b` | `#5a4000` | Elevated risk; activity possible with heightened awareness |
| `status-danger` | `#aa242a` | `#ffffff` | High risk; recommend against the activity for this age group |
| `status-flood` | `#264677` | `#ffffff` | Active flood advisory; do not approach riverbank |

**Decision rule for AI output:** When interpreting conditions, choose a single status for each location × age_bucket combination. Do not blend states within a single recommendation block.

---

## Typography

| Role | Font | Weights | Source |
|---|---|---|---|
| Brand face (headings, UI labels, body) | Nunito Sans | 400 / 500 / 600 / 700 / 800 | Google Fonts, self-hosted via `next/font` |
| User fallback | Arial | Regular / Bold | System font |
| Code / data | Monospace stack | — | System |

**Type hierarchy for dashboard tiles:**
- Tile headline: `text-lg` / `font-semibold` (600)
- Numeric reading (e.g., gage height): `text-3xl` / `font-extrabold` (800)
- Supporting label: `text-sm` / `font-medium` (500) / `text-secondary`
- Advisory body text: `text-base` / `font-normal` (400)

---

## Mobile-first policy

The primary device is a parent's smartphone at a trailhead or parking lot. Design decisions are made at **375 px** and scaled up with `sm:` (640 px+) breakpoints. Never design for desktop first and shrink down.

**Touch target rule:** Every interactive element must be at least **44 × 44 px** (WCAG 2.5.5 AAA / Apple HIG). Use the `touch-target` utility class from `globals.css`.

**No hover-only affordances.** Any interaction signal (color change, icon reveal) that relies on hover must have an equivalent for tap/focus.

**Arm's-length readability:** Key numbers (gage height, temperature, advisory count) should be readable without zooming at arm's length. Minimum `text-2xl` for primary tile values.

---

## Contrast requirements

All foreground/background pairs must pass **WCAG 2.1 AA** (≥ 4.5:1 for normal text, ≥ 3:1 for large text ≥ 18pt or 14pt bold). The `/brand` route runs programmatic verification on every defined pair at render time. Any pair that fails will show a red `✗` in the contrast table.

---

## Logo and city mark

The City of Richmond uses a circular city seal alongside the wordmark "CITY OF RICHMOND" set in CoR Blue. The RVA James dashboard does not use the city seal — it is an independent informational tool. Use the text "RVA James" as the product name without the city seal.

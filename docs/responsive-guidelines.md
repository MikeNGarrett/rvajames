# RVA James — Responsive Design Contract

This document is the source of truth for responsive layout decisions. All Round 3 components (gauge panel, sparkline, detail modal) and any future component work must follow these guidelines.

---

## 1. Page max-width scale

The dashboard is a single-column layout. Container width grows with viewport using the `<PageContainer>` component (`components/ui/PageContainer.tsx`).

| Viewport | Tailwind prefix | Max-width | Notes |
|---|---|---|---|
| < 640px (mobile) | *(base)* | `max-w-lg` ≈ 512px | Primary audience; pixel-identical to v1 |
| 640–767px (sm) | `sm:` | `max-w-xl` ≈ 576px | Narrow tablets, large phones |
| 768–1023px (md) | `md:` | `max-w-3xl` ≈ 768px | Tablets portrait |
| 1024–1279px (lg) | `lg:` | `max-w-4xl` ≈ 896px | Laptops, tablets landscape |
| ≥ 1280px (xl) | `xl:` | `max-w-5xl` ≈ 1024px | Desktop monitors |

**Rationale:** Each step adds enough room for one more location card column without making the AI summary a wall of 120ch text lines. The cap at `max-w-5xl` keeps the dashboard feeling intentional on ultrawide displays.

**Usage:** Every top-level route wraps its primary content in `<PageContainer>`. Do not repeat the class string inline.

```tsx
// Correct
import { PageContainer } from '@/components/ui/PageContainer';

export default function SomePage() {
  return (
    <main>
      <PageContainer className="py-5">
        {/* page content */}
      </PageContainer>
    </main>
  );
}

// Incorrect — repeats the scale in-place
export default function SomePage() {
  return <main className="max-w-lg sm:max-w-xl md:max-w-3xl ... mx-auto px-4 py-5">...</main>;
}
```

---

## 2. Global breakpoints vs container queries

| Use | Rule |
|---|---|
| Page layout (routes, sections) | **Global media query** — `sm:`, `md:`, `lg:`, `xl:` — because it's tied to the page |
| Relocatable components (cards, grids, widgets) | **Container query** — `@container` + `@md:` etc. — because the component may appear in different contexts |

**Rationale:** Container queries make components truly modular. A card or grid should respond to the space it's *given*, not the viewport size.

**Implementation (Tailwind v4):**
```tsx
// Wrapper is the containment context
<div className="@container">
  {/* Children query the @container parent */}
  <div className="grid grid-cols-2 @md:grid-cols-4">
    {/* ... */}
  </div>
</div>
```

Named containers improve clarity when multiple containers nest:
```tsx
<div className="@container/card">
  <div className="@md/card:flex-row flex flex-col">
    {/* responds to the 'card' container */}
  </div>
</div>
```

Do NOT use container queries for page-level layout — they add containment overhead and make debugging harder. Use global breakpoints for routes and top-level layout decisions.

---

## 3. Reading-width discipline

All body-text regions are capped at **65ch** regardless of container width. This prevents eye-strain on wide viewports where a full-container paragraph would be 100+ characters per line.

**Token:** `--reading-width: 65ch` (defined in `app/globals.css`)

**Usage:** Apply `max-w-prose` (Tailwind utility, = 65ch) to:
- AI-generated summary body text (`MetroSummaryPanel` body_md paragraph)
- Advisory body copy
- Safety page paragraphs
- Disclaimer footer content
- Any future AI-narration body text

**What NOT to cap:** Tables, chart containers, card grids, and action areas — these benefit from horizontal space and should remain full container width.

```tsx
// Correct — body text capped
<p className="text-sm leading-relaxed max-w-prose">
  {summary.body_md}
</p>

// Correct — chart uses full width
<div className="w-full">
  <Sparkline data={...} />
</div>
```

---

## 4. Component hierarchy rules

### Hero zones
The gage panel (`RiverSegmentPanel`) and AI summary (`MetroSummaryPanel`) are the primary visual hierarchy. They span the **full container width** on their outer shell. Inner content (gauge bar, sparkline, body text) follows the reading-width cap at the text level.

### Location card grid
- Default (mobile): 1 column
- `sm:` (≥ 640px): 2 columns
- `lg:` (≥ 1024px): 3 columns

The grid uses global breakpoints since it's always at the page level.

### New Round 3 components
The `HorizontalGauge`, `Sparkline`, `TrendArrow`, and detail dialog must follow these rules:
- Outer shell spans the container width.
- Chart/visualization elements have a sensible max-width (~640px) so they don't become absurd ribbons on ultrawide displays.
- Dialog content: text sections use `max-w-prose`, chart sections use full dialog width.
- Each component renders correctly at the full viewport sweep: 375 → 640 → 768 → 1024 → 1280 → 1920px.

---

## 5. Touch-target rules

All interactive elements must meet a minimum 44×44px touch target. Enforced via the `touch-target` utility and the global base rule:

```css
/* app/globals.css — @layer base */
button, a, [role="button"], input, select, textarea {
  min-height: 2.75rem; /* 44px */
}
```

On desktop (hover-capable devices), do NOT remove focus rings or replace them with hover-only states. Touch and keyboard users must see focus indicators on all viewports.

---

## 6. Mobile-first authoring rule

Every Tailwind utility on a component is the **mobile rule**. Breakpoint-prefixed utilities add desktop behavior.

```tsx
// Correct
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">

// Incorrect — starts at lg and never specifies mobile
<div className="lg:grid-cols-3 grid-cols-3">
```

Do not introduce desktop-only component branches. Mobile and desktop render the same component tree; only style values change.

---

## 7. Anti-patterns to avoid

| Anti-pattern | Correct alternative |
|---|---|
| `max-w-lg` hardcoded inline on a route | Use `<PageContainer>` |
| `md:grid-cols-4` on a relocatable component | Use `@container` + `@md:grid-cols-4` |
| Full-width body paragraphs | Wrap in `max-w-prose` |
| Fixed `px` widths for chart containers | Use `w-full` with an inner `max-w-[640px]` cap |
| `text-text-muted/60` opacity reduction | Use `text-text-subtle` token (already passes AA for large text) |
| Removing `text-wrap: balance` from h1–h3 | Headings should always have balance applied |
| `order` or `flex-direction: *-reverse` on interactive content | Reorder in the DOM, not CSS — preserves keyboard tab order |

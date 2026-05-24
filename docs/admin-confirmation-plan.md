# RVA James — Admin Action Safety Plan

## Context

A user just accidentally expired a closure immediately after approving it. They confirmed through a native `window.confirm()` dialog by reflex — the well-documented failure mode of native confirms after a "good" click. The data was repaired manually.

The current admin already has a `ConfirmActionButton` wrapping Expire and Discard with `window.confirm()`. This plan is about going further: the confirmation primitive is too weak for destructive actions, the layout puts safe and destructive actions adjacent to each other, and there's no recovery mechanism for the most common destructive action (Expire — which is reversible at the data layer).

The user explicitly said: "I want a plan to improve the admin experience to prevent this from happening in the future." Not a fix request — a UX plan.

## Inventory: admin actions and their risk profile

| Action | Server function | Effect | Reversible? | Current confirmation | Risk class |
|---|---|---|---|---|---|
| Create | `createClosure` | Inserts new row | Yes (expire/discard) | Form submit | None — additive |
| Update | `updateClosure` | Edits fields on existing row | Yes (re-edit) | Form submit | None — edit-in-place |
| Duplicate | `duplicateClosure` | Copies row as draft | Yes (discard new) | None | None — additive |
| **Approve draft** | `approveDraft` | `draft → active` | Yes (expire) | None | None — happy path |
| **Expire active** | `expireClosure` | `active → expired`, sets `effective_to` | **Yes** — clear `effective_to` + state back to active | `window.confirm()` | Medium — reversible but invisible until noticed |
| **Discard draft** | `discardDraft` | **Hard delete row** | **No** — gone | `window.confirm()` | High — irrecoverable |

Two destructive actions, two different risk profiles. They deserve different treatments.

## Why `window.confirm()` failed here

Three well-known issues, all relevant to this incident:

1. **Reflexive dismissal.** Users learn to click through native confirms, especially when they just confirmed a *different* dialog moments before (the muscle memory carries through).
2. **Native dialogs are visually indistinguishable.** "Are you sure?" looks the same for "discard one row" and "delete the database." There's no severity gradient.
3. **No visual anchoring.** Native confirms appear away from the action that triggered them. Once dismissed, the user has no recollection of which row's button they clicked.

## Design principles for this plan

Drawn from `npx -y modern-web-guidance@latest retrieve declarative-dialog-popover-control,declarative-button-actions` plus standard destructive-UX literature:

- **Match the friction to the cost of undo.** Reversible action → low friction + undo affordance. Irreversible action → high friction + explicit confirmation.
- **Confirmation must be intentional, not reflexive.** Type-to-confirm or a deliberately-placed primary button. No "click anywhere to dismiss."
- **Visual separation between safe and destructive actions.** Different colors, different positions, different sizes. The "Expire" button should not be adjacent to "Approve" in the same row.
- **State changes are visible.** After a successful Approve, the row should visually re-render so the user's "next click" target has demonstrably changed. Prevents the muscle-memory carryover that caused this incident.
- **Undo over confirmation when possible.** For reversible actions, an inline 10-second undo toast is a better safety net than any confirm dialog.

## Plan — execute in order 53 → 57

### Sub-goal 53 — Replace `window.confirm()` with a proper modal dialog

**Why:** Native confirms are dismissed reflexively. A real modal forces explicit interaction and matches the visual language of the rest of the app.

**Modern-web-guidance to retrieve**
- `declarative-dialog-popover-control`
- `light-dismiss-a-dialog`

**Deliverables**
- New `components/admin/ConfirmDialog.tsx`:
  - Uses native `<dialog>` with `closedby="any"` (per the modern-web-guidance pattern already in use for the river-conditions detail modal).
  - Props: `title`, `description`, `confirmLabel`, `confirmVariant: 'danger' | 'caution' | 'primary'`, `onConfirm` (server action).
  - Layout: title, description body, `[Cancel] [Confirm]` button row with Cancel as the default focus and Confirm separated by a visible gap.
  - Cancel is the visually-dominant button (filled neutral); Confirm is outlined danger for destructive actions.
  - Esc, backdrop click, and mobile back-gesture all cancel.
- Refactor `app/admin/closures/ConfirmActionButton.tsx` to use the dialog instead of `window.confirm()`. Same prop shape, no caller changes required.

**Success**
- Clicking Expire on the list view: opens the modal, Esc cancels, Cancel cancels, Confirm fires the action.
- Visual: Cancel button is dominant; Confirm is visually distinct (danger color).
- Keyboard: default focus is Cancel. Tab moves to Confirm. Enter on Confirm fires; Enter on Cancel cancels.
- `pnpm tsc --noEmit && pnpm lint && pnpm build:cf` pass.

### Sub-goal 54 — Type-to-confirm for hard delete (Discard draft)

**Why:** Discard is irreversible. The friction must be proportional. A modal alone is not enough — the user must demonstrate intent.

**Deliverables**
- Extend `ConfirmDialog` (or create a `TypeToConfirmDialog` variant) with optional `typeToConfirm: string` prop.
- When set: the dialog renders an input field labeled `Type "${typeToConfirm}" to confirm`. The Confirm button is disabled until the input exactly matches.
- For Discard: use the closure's location name as the confirmation phrase (already available in the row data: `row.locations.name`).
- Confirm button only enables on exact match (case-sensitive, no leading/trailing whitespace).
- Apply only to `discardDraft` action. Not to Expire (overkill for a recoverable action).

**Success**
- Clicking Discard on a draft for "Belle Isle": modal opens, Confirm disabled, user must type `Belle Isle` exactly, only then does Confirm enable.
- Esc cancels at any point; partial types do not enable Confirm.
- Pasting the location name into the field works (no anti-paste).

### Sub-goal 55 — Undo window for Expire

**Why:** Expire is reversible. An undo toast is a better safety net than any pre-action dialog. This directly addresses the reported incident.

**Deliverables**
- After a successful `expireClosure`, the admin list re-renders with the now-expired row, and a toast appears at the bottom of the viewport:
  - Text: `Expired closure for ${locationName}. Undo`
  - The "Undo" word is a button.
  - Toast persists for 10 seconds. Auto-dismisses after.
- Server action `unexpireClosure(id)` (new): sets `effective_to = null` and `state = 'active'`. Only valid within a freshness window (e.g., 60 seconds after the expire timestamp) — beyond that, the closure must be re-created. This caps the surprise of someone "undoing" a closure that was deliberately expired hours ago by another admin.
- Toast component: use a simple client component with `useEffect` countdown. Could lean on native `<dialog>` set to non-modal mode with auto-dismiss, but a positioned div is simpler.
- A11y: toast has `role="status"` and `aria-live="polite"`. Undo button is keyboard-focusable.

**Success**
- Expire a closure → toast appears with Undo.
- Click Undo within 10s → closure restored to active, toast dismisses.
- Wait 10s → toast auto-dismisses; calling `unexpireClosure` after 60s returns an error and tells the user to re-create.

### Sub-goal 56 — Visual separation between safe and destructive actions

**Why:** The reported incident was a misclick after a successful click. The Expire button being in the same row as Approve is the root cause of the muscle-memory carryover. This is a layout problem, not just a confirmation problem.

**Deliverables**
- In `app/admin/closures/page.tsx` list view, redesign the action column:
  - **Draft state**: only `[Approve] [Discard]` visible. Approve is primary; Discard is icon-only (subtle, smaller, danger color), positioned with deliberate whitespace from Approve.
  - **Active state**: only `[Edit] [Expire]` visible. Edit is neutral; Expire is icon-only (subtle, smaller, danger color), positioned with deliberate whitespace from Edit.
  - **Expired state**: only `[Duplicate]` visible. No destructive actions on expired rows.
- Destructive icons: use lucide-react `Archive` (Expire) and `Trash2` (Discard). They render at 16×16 with a tooltip showing the verb. The icon-only-with-tooltip approach forces the user to recognize the action, not just read text.
- **State-aware re-render after action:** when Approve fires successfully, the row's action set changes (Approve disappears, Expire appears in its place). This is a deliberate UI shift — the user's pointer is now over a different button than they just clicked. Combined with the toast from sub-goal 55, this prevents the reported failure mode.

**Success**
- Visual: Approve button is filled primary; Discard is a small icon button with visible whitespace separating it. Same pattern for Edit + Expire.
- After approving a draft, the row's content shifts (the Approve button is gone, replaced by Edit + Expire). Pointer is no longer over an action.
- Keyboard: tab order matches visual hierarchy (primary action first, destructive last).
- Tooltip on the icon-only buttons announces the verb to assistive tech and on hover.

### Sub-goal 57 — A11y + verification pass

**Why:** New interactive surfaces (modal, type-to-confirm input, toast, icon-only buttons). All deserve an a11y check.

**Deliverables**
- Keyboard-only walkthrough of every admin action path: approve, expire (with undo), discard (with type-to-confirm), edit, duplicate, create.
- Screen reader pass (VoiceOver): every action announces correctly. Icon-only buttons have accessible names. The undo toast is announced when it appears. The type-to-confirm validation state is announced when the input matches.
- Run `npx -y modern-web-guidance@latest retrieve accessibility,accessible-error-announcement` and verify the patterns we used match its recommendations (especially for the type-to-confirm field's `:user-invalid` behavior).
- Lighthouse against `/admin/closures` (with an Access session — may require a manual capture rather than CI): Accessibility ≥ 96.
- Document any deviations or trade-offs in the goal's final summary.

**Success**
- All keyboard paths work without mouse.
- Screen reader announces every state change.
- Lighthouse Accessibility ≥ 96 on the admin route.
- No reduction in admin productivity for routine non-destructive actions (Approve still a single click; Edit still a single click).

---

## What this plan deliberately does NOT do

- **Does not add confirmation to non-destructive actions** (Approve, Duplicate, Edit). Adding friction to the happy path slows down legitimate admin work and trains the user to dismiss dialogs faster.
- **Does not introduce a soft-delete recovery for Discard.** That's a database-schema decision — keep `discardDraft` as a hard delete, defend it with type-to-confirm.
- **Does not add audit logging in this round.** A separate concern; could come later if multiple admins ever exist.
- **Does not add bulk operations.** Bulk actions multiply the cost of misclicks; out of scope for now.

## Execution rules for the agent

- Sub-goals 53 → 54 → 55 → 56 → 57 in order. 53 unblocks 54 (same dialog primitive). 55 is independent but logically follows. 56 can be done in parallel with 55 if it helps.
- For every modern-web-guidance guide cited in the plan, run `retrieve <id>` before implementing.
- Do not modify the data layer (`location_status` table, the server actions' SQL effects). The action functions stay as-is; only the UI calling them changes.
- Use `git` for all changes; commit per sub-goal.
- Single deploy at the end of the round, not after each sub-goal.

## Critical files

- `app/admin/closures/ConfirmActionButton.tsx` — refactored in sub-goal 53 to use the new dialog
- `components/admin/ConfirmDialog.tsx` — new in sub-goal 53
- `components/admin/TypeToConfirmDialog.tsx` (or extended `ConfirmDialog`) — sub-goal 54
- `components/admin/UndoToast.tsx` — new in sub-goal 55
- `app/admin/closures/actions.ts` — adds `unexpireClosure` server action in sub-goal 55
- `app/admin/closures/page.tsx` — visual redesign of action column in sub-goal 56
- `app/admin/closures/[id]/page.tsx` — same dialog primitives applied to detail-page actions

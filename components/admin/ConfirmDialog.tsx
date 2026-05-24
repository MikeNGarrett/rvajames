'use client';

/**
 * ConfirmDialog — sub-goals 53 + 54.
 *
 * Native <dialog> confirmation modal. Replaces window.confirm() for admin
 * destructive actions. Key design choices:
 *
 *   - Cancel is the visually-dominant button (filled neutral).
 *   - Confirm is outlined + color-coded by variant (danger / caution / primary).
 *   - Esc key, backdrop click, and Cancel all invoke onCancel — never fire onConfirm.
 *   - closedby="any" enables light-dismiss declaratively (Chrome/Edge/Firefox 2025+).
 *     A manual backdrop-click listener provides the Safari fallback.
 *   - The dialog enters the top layer via showModal(), so focus is automatically
 *     trapped inside. No custom focus-trap code needed.
 *   - typeToConfirm (sub-goal 54): when set, renders a labeled input; Confirm stays
 *     disabled until the user types the phrase exactly (case-sensitive).
 *     Focus lands on the input when typeToConfirm is present, on Cancel otherwise.
 *
 * Accessibility:
 *   - role="alertdialog" (requires immediate attention / confirms destructive action)
 *   - aria-labelledby → dialog title
 *   - aria-describedby → description paragraph (when present)
 *   - Focus managed imperatively via requestAnimationFrame after showModal()
 */

import { useEffect, useRef, useState } from 'react';

// closedby is Baseline 2025 — not yet in @types/react.
// Augment only within this file to keep the escape hatch local.
declare module 'react' {
  interface DialogHTMLAttributes<T> extends React.HTMLAttributes<T> {
    closedby?: 'any' | 'closerequest' | 'none';
  }
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Optional supporting sentence shown below the title. */
  description?: string;
  /** Label for the confirm button (e.g. "Expire", "Discard"). */
  confirmLabel: string;
  /** Visual style for the confirm button. Defaults to 'danger'. */
  confirmVariant?: 'danger' | 'caution' | 'primary';
  /**
   * Sub-goal 54: when set, the user must type this phrase exactly before
   * Confirm enables. Use the location name for hard-delete (Discard) actions.
   */
  typeToConfirm?: string;
  /** While true, both buttons are disabled and Confirm shows "Working…". */
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRM_STYLES: Record<NonNullable<ConfirmDialogProps['confirmVariant']>, string> = {
  danger:  'border border-status-danger  text-status-danger  hover:bg-status-danger-subtle  focus-visible:ring-status-danger',
  caution: 'border border-status-caution-fg text-status-caution-fg hover:bg-status-caution-subtle focus-visible:ring-status-caution-fg',
  primary: 'border border-rva-blue       text-rva-blue       hover:bg-rva-blue/10           focus-visible:ring-rva-blue',
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  typeToConfirm,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef  = useRef<HTMLDialogElement>(null);
  const cancelRef  = useRef<HTMLButtonElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const [typeInput, setTypeInput] = useState('');

  // ── Open / close via native API + focus management ────────────────────────
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      // Focus the appropriate element after showModal() completes.
      // rAF defers until after the browser has painted the open dialog.
      requestAnimationFrame(() => {
        if (typeToConfirm) {
          inputRef.current?.focus();
        } else {
          cancelRef.current?.focus();
        }
      });
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen, typeToConfirm]);

  // ── Reset type-to-confirm input whenever the dialog closes ────────────────
  useEffect(() => {
    if (!isOpen) setTypeInput('');
  }, [isOpen]);

  // ── Esc key → cancel (preventDefault stops the dialog auto-closing before
  //    we update React state, avoiding a flash of the open dialog) ───────────
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  // ── Backdrop click fallback for Safari (no closedby support) ─────────────
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const handleClick = (e: MouseEvent) => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const insideContent =
        rect.top  <= e.clientY && e.clientY <= rect.top  + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
      if (!insideContent) onCancel();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [onCancel]);

  // Confirm is only enabled when:
  //   • not pending
  //   • if typeToConfirm is set, input matches exactly (case-sensitive, no trim)
  const confirmEnabled =
    !isPending && (typeToConfirm ? typeInput === typeToConfirm : true);

  const inputMismatch = typeToConfirm && typeInput.length > 0 && typeInput !== typeToConfirm;

  return (
    /*
     * IMPORTANT: do NOT apply display-altering utilities (flex, grid, block, etc.)
     * directly to the <dialog> element. The browser UA stylesheet uses
     * `dialog:not([open]) { display: none }` to hide closed dialogs, but author
     * CSS overrides the UA stylesheet — so `display: flex` would make every
     * ConfirmDialog visible on page load even when isOpen=false.
     *
     * Layout (flex-col gap-4) lives on the inner wrapper <div> instead.
     */
    <dialog
      ref={dialogRef}
      closedby="any"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-desc' : undefined}
      aria-modal="true"
      className="confirm-dialog m-auto w-full max-w-sm rounded-xl border border-border bg-surface-raised p-0 shadow-2xl text-left"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-text leading-snug"
        >
          {title}
        </h2>

        {description && (
          <p id="confirm-dialog-desc" className="text-sm text-text-secondary leading-relaxed">
            {description}
          </p>
        )}

        {/* Sub-goal 54: type-to-confirm input ────────────────────────────── */}
        {typeToConfirm && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="type-confirm-input" className="text-sm text-text-secondary">
              Type{' '}
              <strong className="font-semibold text-text select-all">
                {typeToConfirm}
              </strong>{' '}
              to confirm
            </label>
            <input
              ref={inputRef}
              id="type-confirm-input"
              type="text"
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value)}
              placeholder={typeToConfirm}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={inputMismatch ? 'true' : undefined}
              aria-errormessage={inputMismatch ? 'type-confirm-error' : undefined}
              className={`touch-target rounded-lg border px-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 transition-colors ${
                inputMismatch
                  ? 'border-status-danger focus:ring-status-danger'
                  : 'border-border focus:ring-rva-blue'
              }`}
            />
            {inputMismatch && (
              <p
                id="type-confirm-error"
                role="alert"
                className="text-xs text-status-danger"
              >
                Doesn&apos;t match — type exactly as shown.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          {/* Cancel — dominant safe action, default focus (when no typeToConfirm) */}
          <button
            ref={cancelRef}
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="touch-target rounded-lg px-4 text-sm font-semibold bg-surface-raised border border-border text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>

          {/* Confirm — outlined, color signals risk level, gated by typeToConfirm */}
          <button
            type="button"
            disabled={!confirmEnabled}
            onClick={onConfirm}
            className={`touch-target rounded-lg px-4 text-sm font-semibold bg-transparent focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${CONFIRM_STYLES[confirmVariant]}`}
          >
            {isPending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

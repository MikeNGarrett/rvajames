'use client';

/**
 * ConfirmDialog — sub-goal 53.
 *
 * Native <dialog> confirmation modal. Replaces window.confirm() for admin
 * destructive actions. Key design choices:
 *
 *   - Cancel is the default-focused, visually-dominant button (filled neutral).
 *   - Confirm is outlined + color-coded by variant (danger / caution / primary).
 *   - Esc key, backdrop click, and Cancel all invoke onCancel — never fire onConfirm.
 *   - closedby="any" enables light-dismiss declaratively (Chrome/Edge/Firefox 2025+).
 *     A manual backdrop-click listener provides the Safari fallback.
 *   - The dialog enters the top layer via showModal(), so focus is automatically
 *     trapped inside. No custom focus-trap code needed.
 *
 * Accessibility:
 *   - role="alertdialog" (requires immediate attention / confirms destructive action)
 *   - aria-labelledby → dialog title
 *   - aria-describedby → description paragraph (when present)
 *   - autoFocus on Cancel so the safe path is one keypress (Enter / Space) away
 */

import { useEffect, useRef } from 'react';

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
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // ── Open / close via native API ────────────────────────────────────────────
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
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
    // Skip if the browser supports closedby natively
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const handleClick = (e: MouseEvent) => {
      // When clicking the backdrop, the target IS the dialog element itself.
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const insideContent =
        rect.top    <= e.clientY && e.clientY <= rect.top    + rect.height &&
        rect.left   <= e.clientX && e.clientX <= rect.left   + rect.width;
      if (!insideContent) onCancel();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-desc' : undefined}
      aria-modal="true"
      className="confirm-dialog m-auto w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-2xl flex flex-col gap-4 text-left"
    >
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

      <div className="flex items-center justify-end gap-3 pt-1">
        {/*
         * Cancel — dominant safe action. autoFocus so keyboard users immediately
         * have focus on the safest path. One Enter dismisses without damage.
         */}
        <button
          type="button"
          autoFocus
          disabled={isPending}
          onClick={onCancel}
          className="touch-target rounded-lg px-4 text-sm font-semibold bg-surface-raised border border-border text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>

        {/* Confirm — outlined, color signals risk level */}
        <button
          type="button"
          disabled={isPending}
          onClick={onConfirm}
          className={`touch-target rounded-lg px-4 text-sm font-semibold bg-transparent focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 transition-colors ${CONFIRM_STYLES[confirmVariant]}`}
        >
          {isPending ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

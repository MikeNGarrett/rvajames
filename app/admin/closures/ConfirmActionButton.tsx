'use client';

/**
 * ConfirmActionButton — sub-goal 53 refactor.
 *
 * Wraps a trigger button + ConfirmDialog.  The confirmMessage is split on the
 * first blank line (\n\n) into a title (first paragraph) and an optional
 * description (everything after), matching the existing callsite strings.
 *
 * Prop shape is backward-compatible with the window.confirm() version so
 * app/admin/closures/page.tsx needs no changes.
 */

import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { ConfirmDialogProps } from '@/components/admin/ConfirmDialog';

interface Props {
  /** Server action invoked after the user confirms. */
  action: () => Promise<void>;
  /**
   * Confirmation copy.  First paragraph becomes the dialog title; text after
   * the first blank line (\n\n) becomes the supporting description.
   */
  confirmMessage: string;
  /**
   * Optional override for the Confirm button label.
   * Defaults to the button children if it is a string, else "Confirm".
   */
  confirmLabel?: string;
  /** Visual variant for the Confirm button. Defaults to 'danger'. */
  confirmVariant?: ConfirmDialogProps['confirmVariant'];
  className?: string;
  children: React.ReactNode;
}

export function ConfirmActionButton({
  action,
  confirmMessage,
  confirmLabel,
  confirmVariant = 'danger',
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Split "First sentence?\n\nThis is the detail." into title + description.
  const [title, ...rest] = confirmMessage.split('\n\n');
  const description = rest.join('\n\n').trim() || undefined;

  // Derive the confirm button label: explicit prop → children string → fallback
  const resolvedLabel =
    confirmLabel ??
    (typeof children === 'string' ? children : 'Confirm');

  function handleConfirm() {
    startTransition(async () => {
      await action();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>

      <ConfirmDialog
        isOpen={open}
        title={title}
        description={description}
        confirmLabel={resolvedLabel}
        confirmVariant={confirmVariant}
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

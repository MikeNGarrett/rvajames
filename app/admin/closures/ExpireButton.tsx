'use client';

/**
 * ExpireButton — sub-goal 55, extended in sub-goal 62 hotfix.
 *
 * Replaces the ConfirmActionButton at the Expire callsite. After a successful
 * expire it shows an undo toast (via ToastProvider context) that persists even
 * after the row is removed from the server-rendered list.
 *
 * Two visual variants:
 *   - 'icon' (default) — 28×28 archive icon for the closures table row
 *   - 'full' — red-bordered "Expire this closure" button for the edit page
 *     Danger Zone (replaces a broken server-component form+onSubmit that was
 *     causing an Application Error on rvajames.org/admin/closures/[id]).
 *
 * Both variants share the same confirm-dialog + undo-toast flow.
 */

import { useState, useTransition } from 'react';
import { Archive } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdminToast } from '@/components/admin/ToastProvider';
import { expireClosure, unexpireClosure } from './actions';

interface Props {
  id: string;
  locationName: string;
  /**
   * 'icon' (default) — compact archive icon for the table row.
   * 'full' — full Danger Zone button for the edit page.
   */
  variant?: 'icon' | 'full';
}

export function ExpireButton({ id, locationName, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useAdminToast();

  function handleConfirm() {
    startTransition(async () => {
      await expireClosure(id);
      setOpen(false);
      showToast(
        `Expired closure for "${locationName}"`,
        unexpireClosure.bind(null, id),
      );
    });
  }

  return (
    <>
      {variant === 'icon' ? (
        /*
         * Icon-only: Archive icon signals "archiving" (recoverable) rather than
         * destruction. title= provides a native tooltip; aria-label gives AT the
         * full verb for the specific location.
         */
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Expire closure"
          aria-label={`Expire closure for ${locationName}`}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:bg-status-caution-subtle hover:text-status-caution-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-caution-fg transition-colors"
        >
          <Archive size={14} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Expire closure for ${locationName}`}
          className="inline-flex items-center rounded-md border border-status-danger text-status-danger text-sm font-medium px-4 py-2 hover:bg-status-danger hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger transition-colors min-h-[2.75rem]"
        >
          Expire this closure
        </button>
      )}

      <ConfirmDialog
        isOpen={open}
        title={`Expire the closure for "${locationName}"?`}
        description="This sets the end date to now and marks it expired. You can undo within 10 seconds."
        confirmLabel="Expire"
        confirmVariant="caution"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

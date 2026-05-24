'use client';

/**
 * ExpireButton — sub-goal 55.
 *
 * Replaces the ConfirmActionButton at the Expire callsite. After a successful
 * expire it shows an undo toast (via ToastProvider context) that persists even
 * after the row is removed from the server-rendered list.
 */

import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdminToast } from '@/components/admin/ToastProvider';
import { expireClosure, unexpireClosure } from './actions';

interface Props {
  id: string;
  locationName: string;
}

export function ExpireButton({ id, locationName }: Props) {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-text-muted hover:underline font-medium"
      >
        Expire
      </button>

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

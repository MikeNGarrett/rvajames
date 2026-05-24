'use client';

interface Props {
  /** Bound server action to call when the user confirms. */
  action: () => Promise<void>;
  /** Message shown in the browser confirm dialog. */
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Button that pops a browser confirm() dialog before invoking a server action.
 * Prevents accidental destructive clicks (Expire, Discard).
 */
export function ConfirmActionButton({ action, confirmMessage, className, children }: Props) {
  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    await action();
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}

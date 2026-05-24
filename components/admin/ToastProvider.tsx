'use client';

/**
 * ToastProvider — sub-goal 55.
 *
 * A thin React context that lets any client component inside the admin layout
 * show a transient toast notification. The toast state lives here (above the
 * route's Server Component boundary) so it survives route re-renders that
 * happen after server actions call revalidatePath().
 *
 * Usage:
 *   const { showToast } = useAdminToast();
 *   showToast('Expired "Belle Isle"', unexpireClosure.bind(null, id));
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { UndoToast } from './UndoToast';

interface ToastEntry {
  /** Monotonic id so React can key the toast correctly. */
  id: number;
  message: string;
  onUndo: (() => Promise<void>) | null;
}

interface ToastContextValue {
  showToast: (message: string, onUndo?: () => Promise<void>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback(
    (message: string, onUndo?: () => Promise<void>) => {
      idRef.current += 1;
      setToast({ id: idRef.current, message, onUndo: onUndo ?? null });
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <UndoToast
          key={toast.id}
          message={toast.message}
          onUndo={toast.onUndo ?? undefined}
          onDismiss={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useAdminToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useAdminToast must be used inside <ToastProvider>');
  return ctx;
}

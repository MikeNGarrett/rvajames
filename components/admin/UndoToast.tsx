'use client';

/**
 * UndoToast — sub-goal 55.
 *
 * A fixed-position status toast that auto-dismisses after 10 seconds.
 * Rendered by ToastProvider; callers use useAdminToast().showToast().
 *
 * Accessibility:
 *   - role="status" + aria-live="polite": announced by screen readers when it
 *     appears, without interrupting the current reading context.
 *   - The Undo button is keyboard-focusable and has an explicit aria-label.
 *   - The dismiss × button has an accessible label.
 *
 * The 10-second countdown is shown as a thinning progress bar at the bottom
 * of the toast (CSS animation — no JS timers for the visual, only for the
 * actual dismiss). prefers-reduced-motion: the bar is hidden.
 */

import { useEffect, useState, useTransition } from 'react';

const DURATION_MS = 10_000;

interface Props {
  message: string;
  onUndo?: () => Promise<void>;
  onDismiss: () => void;
}

export function UndoToast({ message, onUndo, onDismiss }: Props) {
  const [undoPending, startUndoTransition] = useTransition();

  // Auto-dismiss after DURATION_MS
  useEffect(() => {
    const timer = setTimeout(onDismiss, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  function handleUndo() {
    if (!onUndo) return;
    startUndoTransition(async () => {
      try {
        await onUndo();
      } catch (err) {
        // The server action throws if the 60-second window has passed.
        // Show a brief browser alert; the admin is informed without crashing.
        const msg = err instanceof Error ? err.message : 'Could not undo.';
        window.alert(msg);
      } finally {
        onDismiss();
      }
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm"
    >
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon */}
          <span className="shrink-0 text-text-muted" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"
                fill="currentColor"
              />
              <path
                d="M8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 7.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
                fill="currentColor"
              />
            </svg>
          </span>

          {/* Message */}
          <span className="flex-1 text-sm text-text leading-snug">{message}</span>

          {/* Undo button */}
          {onUndo && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoPending}
              aria-label="Undo the expire action"
              className="shrink-0 text-sm font-semibold text-rva-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue rounded disabled:opacity-50 transition-colors"
            >
              {undoPending ? 'Undoing…' : 'Undo'}
            </button>
          )}

          {/* Dismiss */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="shrink-0 text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue rounded transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Countdown bar — CSS animation, hidden when prefers-reduced-motion */}
        <div
          aria-hidden="true"
          className="h-0.5 bg-rva-blue/30 motion-reduce:hidden"
          style={{
            animationName:     'toast-countdown',
            animationDuration: `${DURATION_MS}ms`,
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
          }}
        />
      </div>

      <style>{`
        @keyframes toast-countdown {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}

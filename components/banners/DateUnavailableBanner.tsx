'use client';

/**
 * DateUnavailableBanner — sub-goal 76
 *
 * Shows when ?notice=date-unavailable is in the URL (set by the server-side
 * redirect when a requested date is outside the 4-day forecast window).
 *
 * Behaviour:
 *   - Renders from the `notice` prop set by the server page
 *   - Auto-dismisses after 8 s
 *   - Dismissible with the × button or the Esc key
 *   - role="alert" + tabIndex={-1} + focus-on-mount for screen reader announcement
 *
 * Screen reader: role="alert" triggers assertive announcement on mount.
 * Focus is moved to the banner so keyboard users are informed before they
 * tab to the chip picker.
 */

import { useEffect, useRef, useState } from 'react';

const AUTO_DISMISS_MS = 8_000;

interface Props {
  /** Value of the ?notice search param; undefined when absent. */
  notice: string | undefined;
}

export function DateUnavailableBanner({ notice }: Props) {
  const [visible, setVisible] = useState(notice === 'date-unavailable');
  const bannerRef = useRef<HTMLDivElement>(null);

  // One-shot: start 8 s timer and focus the banner on mount (SR announcement).
  useEffect(() => {
    if (!visible) return;

    bannerRef.current?.focus();

    const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional — mount-only

  // Esc key dismiss
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      role="alert"
      tabIndex={-1}
      className="flex items-center justify-between gap-3 bg-status-caution/10 border-b border-status-caution/30 px-4 py-3 text-sm text-status-caution-fg focus:outline-none"
    >
      <p>That date isn&rsquo;t available &mdash; showing today&rsquo;s conditions instead.</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss notification"
        className="touch-target shrink-0 flex items-center justify-center rounded-full hover:bg-status-caution/20 transition-colors"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4" aria-hidden>
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>
    </div>
  );
}

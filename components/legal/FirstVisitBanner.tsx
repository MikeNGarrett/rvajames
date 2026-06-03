'use client';

/**
 * FirstVisitBanner — inline dismissable welcome notice for first-time visitors.
 *
 * History
 *   Originally `FirstVisitModal` — a fixed-position overlay that appeared on
 *   first visit. The modal's body paragraph (332x104 px) consistently beat
 *   every other element on the page for Lighthouse LCP, anchoring scores
 *   to whenever hydration finished. Sub-goal 67 deferred the modal mount
 *   by 1500 ms to dodge the LCP race; sub-goal 91 found that workaround
 *   wasn't reliable (Lighthouse picked the modal at ~4 s anyway because the
 *   delayed mount still happened within the LCP observation window).
 *
 *   Path B from the sub-goal 91 triage: convert to an inline banner.
 *   First iteration placed it above the Richmond Conditions section;
 *   that still lost LCP (the banner's body paragraph won over the
 *   headline) AND caused CLS = 0.188 (mounting post-hydration pushed
 *   the 820 px-tall Richmond section down by ~80 px).
 *
 *   Second iteration: banner is rendered at the BOTTOM of the page,
 *   just above the DisclaimerFooter. This kills both problems:
 *
 *     - LCP: banner is below the fold, so it's never an LCP
 *       candidate. The Richmond headline wins LCP unchallenged.
 *     - CLS: when the banner mounts post-hydration, the only thing
 *       that shifts is the DisclaimerFooter (already far below the
 *       viewport), which Lighthouse doesn't count toward CLS.
 *
 *   Third iteration (current): visual + UX overhaul. The earlier
 *   pass blended into the surrounding content and didn't read as
 *   an actionable notice. This pass adds:
 *     - colored left-edge accent + tinted background for callout feel
 *     - real primary button (filled) + secondary button (outlined)
 *       instead of underlined-text "links"
 *     - close (×) icon button in the top-right corner with aria-label
 *     - proper 44 px touch targets on every interactive element
 *
 * Storage key
 *   Preserves `rva-james-safety-acknowledged` so anyone who already
 *   dismissed the modal stays dismissed in the banner version. One-shot
 *   per device — never re-shown after dismissal.
 *
 * Accessibility
 *   Markup is `<aside aria-labelledby="welcome-heading">`. <aside>
 *   creates a complementary landmark; aria-labelledby gives it an
 *   accessible name from the heading text — screen-reader users can
 *   navigate to it via landmark shortcuts.
 *
 *   Deliberately NOT `role="alert"` or `role="status"`. ARIA alerts
 *   are reserved for time-sensitive, important messages that
 *   interrupt the user (form errors, session timeouts) and `role="status"`
 *   is a polite live region for dynamically-injected status updates.
 *   This banner is informational, non-urgent, and present from page
 *   load — over-using alert/status would cause spurious announcements.
 *
 *   The close button is icon-only so it has aria-label="Dismiss
 *   welcome notice". Decorative emoji uses aria-hidden="true".
 *   All interactive controls meet the 44 px touch-target minimum.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'rva-james-safety-acknowledged';

export function FirstVisitBanner() {
  // null = pre-hydration (don't render anything to avoid SSR mismatch).
  // true = should show; false = dismissed (now or earlier).
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    setShow(!localStorage.getItem(STORAGE_KEY));
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  if (show !== true) return null;

  return (
    <aside
      aria-labelledby="welcome-heading"
      className="mb-4 relative rounded-xl border border-border border-l-4 border-l-rva-blue bg-rva-blue/5 p-4 sm:p-5 pr-12"
    >
      {/* Close button — top-right corner, 44x44 touch target */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome notice"
        className="touch-target absolute top-1.5 right-1.5 inline-flex items-center justify-center rounded-full text-text-secondary hover:bg-rva-blue/10 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-2"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <h2
        id="welcome-heading"
        className="text-base font-semibold text-text mb-1.5 flex items-center gap-2"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          👋
        </span>
        Before you head to the river
      </h2>

      <p className="text-sm text-text-secondary leading-relaxed mb-4">
        Real-time sensor data interpreted by AI. Conditions can change
        fast — always watch kids near water and use your own judgment.
      </p>

      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="touch-target inline-flex items-center justify-center px-5 rounded-xl bg-rva-blue text-white font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-2"
        >
          Got it
        </button>
        <Link
          href="/safety"
          onClick={dismiss}
          className="touch-target inline-flex items-center justify-center px-5 rounded-xl border-2 border-rva-blue bg-transparent text-rva-blue font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-2"
        >
          Full safety guidance →
        </Link>
      </div>
    </aside>
  );
}

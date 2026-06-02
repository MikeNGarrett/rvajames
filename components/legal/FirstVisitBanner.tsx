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
 *   No overlay, no LCP race — the banner is part of normal page flow,
 *   sits below the page header, and is sized small enough (text-sm,
 *   compact 1-line body, ≤ ~80 px tall on mobile) that the Richmond
 *   Conditions headline (text-3xl, ~80 px tall × full width) remains
 *   the largest above-fold contentful element.
 *
 * Storage key
 *   Preserves `rva-james-safety-acknowledged` so anyone who already
 *   dismissed the modal stays dismissed in the banner version. One-shot
 *   per device — never re-shown after dismissal.
 *
 * Accessibility
 *   - Renders as `<aside aria-labelledby="welcome-heading">` so screen
 *     readers announce it as a complementary landmark with the heading
 *     text. Not a `role="dialog"` — it's no longer modal/blocking.
 *   - Dismiss button is a real `<button>` with adequate touch target.
 *   - Link to /safety inherits app underline + focus styles.
 *
 * CLS note
 *   The banner mounts client-side after hydration reads localStorage,
 *   so first-time visitors see a one-time content shift (~80 px) as the
 *   banner appears. Returning visitors see no shift. Lighthouse runs
 *   with cleared storage so will tick CLS up slightly — acceptable
 *   trade for eliminating the much larger LCP problem.
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
      className="mb-4 rounded-xl border border-border bg-surface-raised p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-base leading-none mt-0.5 flex-shrink-0">
          👋
        </span>
        <div className="flex-1 min-w-0">
          <h2
            id="welcome-heading"
            className="text-sm font-semibold text-text mb-1"
          >
            Before you head to the river
          </h2>
          <p className="text-sm text-text-secondary leading-snug mb-2">
            Real-time sensor data interpreted by AI. Conditions can change
            fast — always watch kids near water and use your own judgment.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              onClick={dismiss}
              type="button"
              className="text-sm font-semibold text-rva-blue underline decoration-2 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue rounded-sm"
            >
              Got it
            </button>
            <Link
              href="/safety"
              onClick={dismiss}
              className="text-sm text-rva-blue underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue rounded-sm"
            >
              Full safety guidance →
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

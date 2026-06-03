'use client';

/**
 * FirstVisitBanner — inline dismissable welcome notice for first-time visitors.
 *
 * History
 *   Originally `FirstVisitModal` — a fixed-position overlay that appeared on
 *   first visit. The modal's body paragraph consistently won Lighthouse LCP
 *   regardless of where on the page it was rendered. Sub-goal 67's
 *   1500 ms deferred mount didn't reliably dodge the LCP measurement window.
 *
 *   Sub-goal 91 converted the modal to an inline banner across three
 *   iterations:
 *
 *     1. Banner above the Richmond section, client-rendered after
 *        hydration. Lost: still won LCP (322x66 body paragraph beat the
 *        text-3xl headline) AND caused CLS = 0.188 (post-hydration
 *        mount shifted 820 px of visible content).
 *     2. Banner moved below the fold (above DisclaimerFooter). Won the
 *        Lighthouse scores but the banner was effectively invisible —
 *        first-time visitors never saw it without scrolling. "Not
 *        doing its job."
 *     3. CURRENT: banner restored to the top of the main content, but
 *        with two changes that make it safe there:
 *
 *        a. Cookie-driven SSR. The server reads `rva-james-safety-
 *           acknowledged` on every request and renders the banner only
 *           when it's absent. Returning visitors get zero banner DOM
 *           — no shift on mount. First-time visitors get the banner
 *           inline in the initial HTML — also no shift.
 *        b. Compact body copy + size-constrained layout so the
 *           Richmond Conditions headline (text-3xl, ~80 px tall × full
 *           width) remains the largest above-fold contentful element
 *           in pixel area. Banner body is two short sentences at
 *           text-sm — smaller in painted area than the headline.
 *
 * Storage strategy
 *   Authoritative state lives in a `rva-james-safety-acknowledged`
 *   cookie (1 year, SameSite=Lax, Secure on HTTPS). The server reads
 *   it to decide initial render. Dismiss action writes the cookie.
 *
 *   For backwards compatibility with the modal era's localStorage-
 *   based dismissals, the client checks localStorage on mount; if it
 *   finds an existing dismissal, it migrates the value to a cookie
 *   and hides the banner. So users who dismissed the modal never see
 *   the banner re-appear.
 *
 * Accessibility
 *   Markup is `<aside aria-labelledby="welcome-heading">` — a
 *   complementary landmark with an accessible name from the heading.
 *
 *   Deliberately NOT `role="alert"` or `role="status"`. ARIA alerts
 *   are reserved for time-sensitive interrupts (form errors, session
 *   timeouts); `role="status"` is for dynamically-injected polite
 *   live regions. This banner is informational, non-urgent, and
 *   present from page load — over-using alert/status would cause
 *   spurious screen-reader announcements.
 *
 *   Close button is icon-only so it has aria-label="Dismiss welcome
 *   notice". Decorative emoji uses aria-hidden="true". All
 *   interactive controls meet the 44 px touch-target minimum and have
 *   cursor-pointer + hover/active state styles.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'rva-james-safety-acknowledged';

interface Props {
  /**
   * Server-resolved visibility based on the cookie. When false, banner
   * never renders. When true, banner renders inline in initial HTML
   * (no client-mount shift) until the user dismisses or until a legacy
   * localStorage dismissal is detected post-hydration.
   */
  initiallyVisible: boolean;
}

export function FirstVisitBanner({ initiallyVisible }: Props) {
  const [visible, setVisible] = useState(initiallyVisible);

  /**
   * Migrate legacy localStorage dismissals to a cookie + hide the
   * banner. Runs once on mount; only fires for users who dismissed
   * the modal era's localStorage flag before this cookie-based
   * implementation shipped.
   */
  useEffect(() => {
    if (!initiallyVisible) return;
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) return;

    setCookie();
    setVisible(false);
  }, [initiallyVisible]);

  function setCookie() {
    // 1 year, root path, SameSite=Lax; Secure when on HTTPS.
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STORAGE_KEY}=1; max-age=31536000; path=/; SameSite=Lax${secure}`;
  }

  function dismiss() {
    setCookie();
    // Mirror to localStorage so cross-tab dismissal stays consistent
    // even if a stale tab loads the page before the new cookie reaches it.
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* localStorage may be disabled in private mode — cookie still wins */
    }
    setVisible(false);
  }

  if (!visible) return null;

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
        className="touch-target absolute top-1.5 right-1.5 inline-flex items-center justify-center rounded-full text-text-secondary cursor-pointer transition-colors hover:bg-rva-blue/10 hover:text-text active:bg-rva-blue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-2"
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

      <p className="text-sm text-text-secondary leading-snug mb-4">
        Real-time sensor data plus AI interpretation — conditions change
        fast. Always watch kids near water.
      </p>

      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="touch-target inline-flex items-center justify-center px-5 rounded-xl bg-rva-blue text-white font-semibold text-sm cursor-pointer transition-colors hover:bg-rva-blue/90 active:bg-rva-blue/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-2"
        >
          Got it
        </button>
        <Link
          href="/safety"
          onClick={dismiss}
          className="touch-target inline-flex items-center justify-center px-5 rounded-xl border-2 border-rva-blue bg-transparent text-rva-blue font-semibold text-sm cursor-pointer transition-colors hover:bg-rva-blue/10 active:bg-rva-blue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-2"
        >
          Full safety guidance →
        </Link>
      </div>
    </aside>
  );
}

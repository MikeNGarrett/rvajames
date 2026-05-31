'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'rva-james-safety-acknowledged';
/**
 * Modal-show delay (ms). Defers the open=true transition so the page's
 * deterministic content paints + becomes the LCP candidate BEFORE this
 * fixed-position dialog appears. Without the delay, the modal renders
 * within ~50ms of hydration and is the largest contentful element on
 * screen, anchoring Lighthouse LCP to whenever hydration finishes (~3-4s
 * under mobile throttling) — knocking homepage Performance down to ~86.
 *
 * 1500ms is comfortably past the "good" LCP threshold (2.5s) so LCP
 * never picks the modal, while still appearing quickly enough that
 * first-time visitors see the safety notice before they meaningfully
 * interact with the page.
 *
 * In modern browsers we also prefer requestIdleCallback as a stronger
 * "wait until the page is settled" signal; the setTimeout is the
 * fallback for browsers without rIC (Safari historically lagged).
 */
const MODAL_SHOW_DELAY_MS = 1500;

export function FirstVisitModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    };

    type W = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?:  (id: number) => void;
    };
    const w = window as W;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(show, { timeout: MODAL_SHOW_DELAY_MS + 1000 });
      return () => w.cancelIdleCallback?.(id);
    }

    const t = setTimeout(show, MODAL_SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-surface-raised rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 id="modal-title" className="text-lg font-semibold text-text mb-3">
          Before you head to the river
        </h2>
        <p className="text-sm text-text-secondary mb-3 leading-relaxed">
          This app pulls real sensor data and uses AI to interpret conditions for families.
          Conditions can change fast. Always watch kids near water and use your own judgment.
        </p>
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
          Read our{' '}
          <Link href="/safety" className="text-rva-blue underline" onClick={dismiss}>
            safety resources
          </Link>{' '}
          for official guidance from the AAP, NPS, and USCG.
        </p>
        <button
          onClick={dismiss}
          className="touch-target w-full rounded-xl bg-rva-blue text-white font-semibold text-base py-3"
        >
          Got it — let&apos;s plan our trip
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'rva-james-safety-acknowledged';

export function FirstVisitModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
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

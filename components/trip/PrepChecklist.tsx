'use client';

import { useState, useEffect } from 'react';

interface Props {
  items: string[];
  storageKey: string;
}

export function PrepChecklist({ items, storageKey }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setChecked(new Set(JSON.parse(stored) as number[]));
    } catch { /* ignore */ }
  }, [storageKey]);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-base font-semibold text-text">Trip prep</h3>
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <button
              onClick={() => toggle(i)}
              className={`touch-target w-full flex items-center gap-3 px-4 py-3 text-left ${i < items.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  checked.has(i)
                    ? 'bg-rva-blue border-rva-blue text-white'
                    : 'border-border bg-surface-raised'
                }`}
                aria-hidden
              >
                {checked.has(i) && '✓'}
              </span>
              <span
                className={`text-sm ${checked.has(i) ? 'text-text-muted line-through' : 'text-text'}`}
              >
                {item}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

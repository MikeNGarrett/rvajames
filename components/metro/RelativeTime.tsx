'use client';

/**
 * Client-only renderers for time-dependent text that would otherwise cause
 * React #418 hydration mismatches.
 *
 * Both helpers below compute strings from `Date.now()` at render time. The
 * server's clock at request time and the browser's clock at hydration time
 * are different — the resulting text doesn't match and React falls back to
 * client re-render with a minified error in production.
 *
 * Solution: render `null` on the server and during the first client render
 * (both see `useState(null)`), then populate via `useEffect` after mount.
 * The transition from null → text happens after hydration is complete, so
 * there is no SSR/client divergence.
 */

import { useEffect, useState } from 'react';
import { TrendArrow } from '@/components/ui/TrendArrow';

// ─── ageLabel (was: top of RiverSegmentPanel.tsx) ────────────────────────────
function ageLabel(fetchedAt: string): string {
  const m = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

interface RelativeAgeTextProps {
  /** ISO timestamp. If null, renders nothing. */
  timestamp: string | null;
  /** Text rendered before the age label (e.g., " Last update "). */
  prefix?: string;
  /** Text rendered after the age label (e.g., "."). */
  suffix?: string;
}

/**
 * Renders a relative age label ("just now" / "5m ago" / "2h ago") that
 * updates every 60s. Returns null on SSR + first client render — text
 * appears after `useEffect` fires post-hydration. Prefix and suffix are
 * also conditional so the sentence reads cleanly in both states.
 */
export function RelativeAgeText({
  timestamp,
  prefix = '',
  suffix = '',
}: RelativeAgeTextProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!timestamp) return;
    const update = () => setLabel(ageLabel(timestamp));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!label) return null;
  return <>{prefix}{label}{suffix}</>;
}

// ─── oneHourAgoValue (was: top of RiverSegmentPanel.tsx) ─────────────────────
function oneHourAgoValue(
  recent72h: { t: number; v: number }[],
): number | null {
  const targetMs = Date.now() - 60 * 60 * 1000;
  let best: { t: number; v: number } | null = null;
  for (const p of recent72h) {
    const diff = Math.abs(p.t - targetMs);
    if (!best || diff < Math.abs(best.t - targetMs)) best = p;
  }
  if (!best || Math.abs(best.t - targetMs) > 15 * 60 * 1000) return null;
  return best.v;
}

interface ClientTrendArrowProps {
  currentValue: number;
  recent72h: { t: number; v: number }[];
  unit: string;
  semantics?: 'safety' | 'flow' | 'neutral';
  precision?: number;
}

/**
 * Renders a <TrendArrow> using a client-side-computed `valueOneHourAgo` so
 * the rendered text ("↑ 0.12 ft/h") doesn't differ between SSR and hydration.
 */
export function ClientTrendArrow({
  currentValue,
  recent72h,
  unit,
  semantics = 'safety',
  precision,
}: ClientTrendArrowProps) {
  const [valueOneHourAgo, setValue] = useState<number | null>(null);

  useEffect(() => {
    setValue(oneHourAgoValue(recent72h));
  }, [recent72h]);

  if (valueOneHourAgo === null) return null;
  return (
    <TrendArrow
      currentValue={currentValue}
      valueOneHourAgo={valueOneHourAgo}
      unit={unit}
      semantics={semantics}
      precision={precision}
    />
  );
}

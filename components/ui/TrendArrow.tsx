/**
 * TrendArrow — sub-goal 36.
 * Shows ↑ / ↓ / → with the absolute delta and semantic color.
 *
 * For swim-relevant parameters (water level, temp):
 *   rising = caution, falling = good
 * For flow-speed parameters (discharge):
 *   caller passes direction="flow" which reverses the color semantics.
 *
 * This component is purely presentational text — it does not use SVG.
 */

interface Props {
  currentValue: number;
  valueOneHourAgo: number | null;
  unit: string;
  /**
   * "safety":  rising = caution color, falling = safe color (default — gage height)
   * "flow":    rising = safe color (more kayak flow), falling = caution
   * "neutral": no color semantics, always muted
   */
  semantics?: 'safety' | 'flow' | 'neutral';
  /** Number of decimal places for the delta display. Default: 2. */
  precision?: number;
}

export function TrendArrow({
  currentValue,
  valueOneHourAgo,
  unit,
  semantics = 'safety',
  precision = 2,
}: Props) {
  if (valueOneHourAgo === null) return null;

  const delta = currentValue - valueOneHourAgo;
  const absDelta = Math.abs(delta);

  // Threshold: ignore change less than half a unit in the last sig-fig
  const threshold = 0.5 * Math.pow(10, -precision);
  if (absDelta < threshold) {
    return (
      <span className="text-text-muted text-xs" aria-label="River level steady">
        → steady
      </span>
    );
  }

  const rising = delta > 0;
  const arrow  = rising ? '↑' : '↓';
  const label  = rising ? 'rising' : 'falling';

  let colorClass: string;
  if (semantics === 'neutral') {
    colorClass = 'text-text-muted';
  } else if (semantics === 'flow') {
    colorClass = rising ? 'text-status-safe-fg' : 'text-status-caution-fg';
  } else {
    // safety: rising is bad for most river activities
    colorClass = rising ? 'text-status-caution-fg' : 'text-status-safe-fg';
  }

  const deltaStr = `${absDelta.toFixed(precision)} ${unit}/h`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${colorClass}`}
      aria-label={`${label} ${deltaStr}`}
    >
      <span aria-hidden="true">{arrow}</span>
      {deltaStr}
    </span>
  );
}

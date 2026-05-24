/**
 * HorizontalGauge — sub-goal 36.
 * Pure SVG horizontal bar showing a value relative to a range, with a
 * shaded "normal" band and an optional "critical" band.
 *
 * ARIA: role="meter" with valuenow/min/max/valuetext for AT.
 * Purely visual: labels are rendered as SVG <text> elements (decorative).
 */

interface Band {
  low: number;
  high: number;
}

interface Props {
  /** Current reading (same units as min/max). */
  value: number;
  min: number;
  max: number;
  /** P25–P75 or equivalent "normal" range — shaded distinctly on the track. */
  normalBand: Band;
  /** Optional danger zone — shaded in danger color at the high end. */
  criticalBand?: Band;
  /** Short text for the aria-valuetext (e.g., "3.7 feet — normal range"). */
  ariaLabel: string;
  /** Short labels under band boundaries.  max 3 labels for readability. */
  bandLabels?: Array<{ value: number; label: string }>;
}

/** Map a value into [0, 1] within [min, max], clamped. */
function norm(v: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

const TRACK_H   = 10;   // track height px
const MARKER_R  = 7;    // current-value dot radius
const SVG_H     = 32;   // total component height

export function HorizontalGauge({
  value,
  min,
  max,
  normalBand,
  criticalBand,
  ariaLabel,
  bandLabels,
}: Props) {
  // We'll render at a logical width of 200 and scale via viewBox.
  const W = 200;
  const PAD_X = MARKER_R; // left/right padding so the dot doesn't clip
  const trackW = W - PAD_X * 2;
  const trackY = (SVG_H - TRACK_H) / 2;

  const x = (v: number) => PAD_X + norm(v, min, max) * trackW;

  const normalX1 = x(normalBand.low);
  const normalX2 = x(normalBand.high);

  const critX1 = criticalBand ? x(criticalBand.low)  : 0;
  const critX2 = criticalBand ? x(criticalBand.high) : 0;

  const markerX = x(value);

  return (
    <svg
      role="meter"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={ariaLabel}
      viewBox={`0 0 ${W} ${SVG_H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${SVG_H}px` }}
      aria-label={ariaLabel}
    >
      {/* Track background */}
      <rect
        x={PAD_X}
        y={trackY}
        width={trackW}
        height={TRACK_H}
        rx={TRACK_H / 2}
        className="fill-border"
      />

      {/* Normal band (p25–p75) */}
      <rect
        x={normalX1}
        y={trackY}
        width={Math.max(0, normalX2 - normalX1)}
        height={TRACK_H}
        className="fill-rva-blue/20"
      />

      {/* Critical band */}
      {criticalBand && (
        <rect
          x={critX1}
          y={trackY}
          width={Math.max(0, critX2 - critX1)}
          height={TRACK_H}
          className="fill-status-danger/30"
        />
      )}

      {/* Filled bar up to current value */}
      <rect
        x={PAD_X}
        y={trackY}
        width={Math.max(0, markerX - PAD_X)}
        height={TRACK_H}
        rx={TRACK_H / 2}
        className="fill-rva-blue/60"
      />

      {/* Current value marker dot */}
      <circle
        cx={markerX}
        cy={trackY + TRACK_H / 2}
        r={MARKER_R}
        className="fill-rva-blue stroke-surface"
        strokeWidth={2}
      />

      {/* Band labels — rendered below track */}
      {bandLabels?.map(({ value: v, label }) => (
        <text
          key={label}
          x={x(v)}
          y={SVG_H - 2}
          textAnchor="middle"
          className="fill-text-muted"
          style={{ fontSize: '7px', fontFamily: 'inherit' }}
          aria-hidden="true"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

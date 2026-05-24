/**
 * HorizontalGauge — responsive CSS reimplementation.
 *
 * Replaces the old SVG version that used preserveAspectRatio="none",
 * which caused non-uniform stretching at different container widths and
 * clipped the "Flood" label at the right edge.
 *
 * ARIA: role="meter" with valuenow/min/max/valuetext for AT.
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
  /** P25–P75 or equivalent "normal" range — shaded on the track. */
  normalBand: Band;
  /** Optional danger zone — shaded in danger color at the high end. */
  criticalBand?: Band;
  /** Short text for the aria-valuetext (e.g., "3.7 feet — normal range"). */
  ariaLabel: string;
  /** Short labels placed under band boundaries.  Max 4 for readability. */
  bandLabels?: Array<{ value: number; label: string }>;
}

/** Clamp v to [0,100] and format as a percent string. */
function pct(v: number, min: number, max: number): string {
  return `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)).toFixed(2)}%`;
}

/** Width between two values as a percent of the full range. */
function widthPct(lo: number, hi: number, min: number, max: number): string {
  return `${Math.max(0, ((hi - lo) / (max - min)) * 100).toFixed(2)}%`;
}

export function HorizontalGauge({
  value,
  min,
  max,
  normalBand,
  criticalBand,
  ariaLabel,
  bandLabels,
}: Props) {
  const vPct = pct(value, min, max);
  const p    = (v: number) => pct(v, min, max);
  const w    = (lo: number, hi: number) => widthPct(lo, hi, min, max);

  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={ariaLabel}
      aria-label={ariaLabel}
      className="select-none"
    >
      {/*
       * mx-2 leaves 8 px on each side so the 14 px marker dot (±7 px from
       * center) doesn't spill outside the component at min/max values.
       */}
      <div className="relative h-2.5 rounded-full bg-border mx-2">
        {/* Normal band */}
        <div
          className="absolute inset-y-0 bg-rva-blue/20"
          style={{ left: p(normalBand.low), width: w(normalBand.low, normalBand.high) }}
        />

        {/* Critical / danger band */}
        {criticalBand && (
          <div
            className="absolute inset-y-0 bg-status-danger/30 rounded-r-full"
            style={{ left: p(criticalBand.low), width: w(criticalBand.low, criticalBand.high) }}
          />
        )}

        {/* Filled bar from the left up to the current value */}
        <div
          className="absolute inset-y-0 left-0 bg-rva-blue/60 rounded-full"
          style={{ width: vPct }}
        />

        {/* Current-value marker dot — centered on the value position */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-rva-blue border-2 border-surface"
          style={{ left: vPct }}
        />
      </div>

      {/* Band labels — rendered below the track */}
      {bandLabels && bandLabels.length > 0 && (
        <div className="relative h-4 mt-1 mx-2" aria-hidden="true">
          {bandLabels.map(({ value: v, label }, i) => {
            // Left-align the first label, right-align the last, center the rest.
            const align =
              i === 0
                ? ''
                : i === bandLabels.length - 1
                ? '-translate-x-full'
                : '-translate-x-1/2';
            return (
              <span
                key={label}
                className={`absolute top-0 text-[7px] text-text-muted whitespace-nowrap leading-none ${align}`}
                style={{ left: p(v) }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

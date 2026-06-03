/**
 * HorizontalGauge — responsive CSS reimplementation.
 *
 * Replaces the old SVG version that used preserveAspectRatio="none",
 * which caused non-uniform stretching at different container widths and
 * clipped the "Flood" label at the right edge.
 *
 * Layout (sub-goal 91 revision)
 *   The track is `overflow-hidden` + `rounded-full`, so every band and
 *   fill rendered inside the track is automatically clipped to the
 *   pill shape. This means individual children don't need their own
 *   `rounded-*` classes to render with rounded ends — they inherit
 *   the track's pill mask via clipping. The previous implementation
 *   had each band carrying its own `rounded-full`, which caused two
 *   bugs:
 *
 *     1. A band positioned mid-track (e.g. the happiness "normal"
 *        band at 60-100 %) had its OWN rounded ends. Its left edge
 *        was a 5 px-radius curve sitting at x = 60 %, not the
 *        straight vertical line you'd expect — visually overlapped
 *        the marker dot weirdly.
 *     2. A band extending to the right edge (the same 60-100 % band)
 *        would render its right edge as a flat rectangle if the
 *        `rounded-full` class was missing, OR with its own rounded
 *        cap that didn't quite align with the track's pill curve.
 *        Either way looked wrong against the surrounding pill.
 *
 *   With clipping, both problems disappear. Bands are rectangles; the
 *   pill mask handles the rounded ends.
 *
 *   The marker dot has to stay OUTSIDE the clipped track because it
 *   intentionally extends ±2 px above/below the track height. Placing
 *   it as a sibling of the track (inside the same outer container)
 *   lets it render unclipped while still being positioned by the same
 *   percentage as the fill.
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
       * Outer container for the bar row. `mx-2` leaves 8 px on each
       * side so the 14 px marker dot (±7 px from center) doesn't
       * spill outside the component at min/max values.
       */}
      <div className="relative h-2.5 mx-2">
        {/*
         * Track — pill shape, clips children to its rounded ends.
         * Filling the outer container exactly (`inset-0`) so band
         * percentages line up with the marker dot's percentages.
         */}
        <div className="absolute inset-0 rounded-full bg-border overflow-hidden">
          {/* Normal band — clipped to pill on left/right ends */}
          <div
            className="absolute inset-y-0 bg-rva-blue/20"
            style={{ left: p(normalBand.low), width: w(normalBand.low, normalBand.high) }}
          />

          {/* Critical / danger band — clipped to pill on left/right ends */}
          {criticalBand && (
            <div
              className="absolute inset-y-0 bg-status-danger/30"
              style={{ left: p(criticalBand.low), width: w(criticalBand.low, criticalBand.high) }}
            />
          )}

          {/* Filled bar from the left up to the current value */}
          <div
            className="absolute inset-y-0 left-0 bg-rva-blue/60"
            style={{ width: vPct }}
          />
        </div>

        {/*
         * Current-value marker dot — sibling of the track so it can
         * extend the 2 px above/below the 10 px track height without
         * being clipped. Positioned by the same percentage as the
         * fill so they always line up.
         */}
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
                className={`absolute top-0 text-xs text-text-muted whitespace-nowrap leading-none ${align}`}
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

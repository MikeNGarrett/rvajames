/**
 * Sparkline — sub-goal 36.
 * Pure SVG time-series line with an optional shaded normal-range band.
 * Decorative: aria-hidden. Data context is announced via surrounding text.
 *
 * Points are {t, v} where t is a Unix timestamp in ms and v is the value.
 */

interface Point {
  t: number;  // timestamp ms
  v: number;
}

interface Props {
  points: Point[];
  /**
   * Optional shaded normal band at fixed low/high values
   * (e.g., p25 and p75 from USGS percentile data).
   */
  normalBand?: { low: number; high: number };
  /** Tailwind color class for the line, e.g. "stroke-rva-blue". */
  lineClass?: string;
  height?: number;
}

function buildPath(points: Point[], xScale: (t: number) => number, yScale: (v: number) => number): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.v).toFixed(1)}`)
    .join(' ');
}

export function Sparkline({
  points,
  normalBand,
  lineClass = 'stroke-rva-blue',
  height = 40,
}: Props) {
  if (points.length < 2) return null;

  const W = 300;
  const H = height;
  const PAD = 4;

  const tMin = Math.min(...points.map((p) => p.t));
  const tMax = Math.max(...points.map((p) => p.t));

  const vMin = Math.min(...points.map((p) => p.v), normalBand?.low ?? Infinity);
  const vMax = Math.max(...points.map((p) => p.v), normalBand?.high ?? -Infinity);
  const vPad = (vMax - vMin) * 0.1 || 1;

  const xScale = (t: number) =>
    PAD + ((t - tMin) / (tMax - tMin || 1)) * (W - PAD * 2);
  const yScale = (v: number) =>
    H - PAD - ((v - (vMin - vPad)) / (vMax - vMin + vPad * 2)) * (H - PAD * 2);

  const linePath = buildPath(points, xScale, yScale);

  // Normal band as a filled rect spanning full width
  const bandY1 = normalBand ? yScale(normalBand.high) : 0;
  const bandY2 = normalBand ? yScale(normalBand.low)  : 0;

  // Current-value marker (last point)
  const last = points[points.length - 1];
  const markerX = xScale(last.t);
  const markerY = yScale(last.v);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${H}px` }}
    >
      {/* Normal band shading */}
      {normalBand && (
        <rect
          x={PAD}
          y={bandY1}
          width={W - PAD * 2}
          height={Math.max(0, bandY2 - bandY1)}
          className="fill-rva-blue/10"
        />
      )}

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        className={lineClass}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Current value dot */}
      <circle
        cx={markerX}
        cy={markerY}
        r={3}
        className="fill-rva-blue stroke-surface"
        strokeWidth={1.5}
      />
    </svg>
  );
}

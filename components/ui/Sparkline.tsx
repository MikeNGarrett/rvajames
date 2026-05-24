/**
 * Sparkline — sub-goal 36.
 * Pure SVG time-series line with an optional shaded normal-range band.
 * Decorative: aria-hidden. Data context is announced via surrounding text.
 *
 * Points are {t, v} where t is a Unix timestamp in ms and v is the value.
 *
 * Desktop note: the SVG uses preserveAspectRatio="none" so it fills its
 * container width regardless of aspect ratio. A plain SVG <circle> deforms
 * into a wide flat ellipse at extreme widths (e.g. 1024px × 40px).
 * The current-value marker is therefore rendered via <foreignObject> so the
 * dot stays a true circle at any container width.
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
   * Only the portion overlapping the visible data range is shaded.
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

  // Y range is derived from data only — not from normalBand.
  // Including normalBand.low/high (e.g., 0–4 ft) would collapse a
  // small variation like 3.69–3.90 ft into a nearly-flat line.
  const dataMin = Math.min(...points.map((p) => p.v));
  const dataMax = Math.max(...points.map((p) => p.v));
  const vPad    = (dataMax - dataMin) * 0.15 || 0.5;
  const vLo     = dataMin - vPad;
  const vHi     = dataMax + vPad;

  const xScale = (t: number) =>
    PAD + ((t - tMin) / (tMax - tMin || 1)) * (W - PAD * 2);

  // SVG Y axis is top-down: higher values → smaller Y pixel.
  const yScale = (v: number) =>
    H - PAD - ((v - vLo) / (vHi - vLo)) * (H - PAD * 2);

  const linePath = buildPath(points, xScale, yScale);

  // Only shade the portion of normalBand that overlaps the visible range.
  const bandLo   = normalBand ? Math.max(vLo, normalBand.low)  : 0;
  const bandHi   = normalBand ? Math.min(vHi, normalBand.high) : 0;
  const showBand = normalBand != null && bandHi > bandLo;
  const bandY1   = showBand ? yScale(bandHi) : 0;
  const bandY2   = showBand ? yScale(bandLo) : 0;

  // Current-value marker position (last point)
  const last    = points[points.length - 1];
  const markerX = xScale(last.t);
  const markerY = yScale(last.v);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height: `${H}px` }}
    >
      {/* Normal band shading — only the visible portion */}
      {showBand && (
        <rect
          x={PAD}
          y={bandY1}
          width={W - PAD * 2}
          height={Math.max(0, bandY2 - bandY1)}
          className="fill-rva-blue/10"
        />
      )}

      {/* Trend line — vectorEffect keeps stroke width consistent at any aspect ratio */}
      <path
        d={linePath}
        fill="none"
        className={lineClass}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/*
       * Current-value marker rendered via foreignObject so the dot stays a
       * true CSS circle regardless of the SVG's horizontal stretch.
       *
       * The foreignObject x/y are in SVG user-space (correctly positioned by
       * the transform), while the div inside renders at screen pixels (no
       * distortion). width="0" height="0" + overflow="visible" avoids any
       * clipping from the foreignObject bounding box.
       */}
      <foreignObject
        x={markerX}
        y={markerY}
        width="0"
        height="0"
        overflow="visible"
      >
        <div
          style={{
            position:     'absolute',
            width:        '10px',
            height:       '10px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-rva-blue, #264677)',
            border:       '2px solid var(--color-surface, white)',
            transform:    'translate(-50%, -50%)',
          }}
        />
      </foreignObject>
    </svg>
  );
}

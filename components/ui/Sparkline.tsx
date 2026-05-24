/**
 * Sparkline — sub-goal 36.
 * Pure SVG time-series line with an optional shaded normal-range band.
 * Decorative: aria-hidden. Data context is announced via surrounding text.
 *
 * Points are {t, v} where t is a Unix timestamp in ms and v is the value.
 *
 * Desktop note: the SVG uses preserveAspectRatio="none" so it fills its
 * container width regardless of aspect ratio. An SVG <circle> (or a
 * <foreignObject> div) both inherit the non-uniform scale and deform into
 * an ellipse at extreme aspect ratios (e.g. 1536px × 40px).
 * The current-value marker is therefore rendered as an absolutely-positioned
 * CSS div layered on top of the SVG, positioned via percentage coordinates
 * derived from the SVG user-space coordinates. CSS border-radius:50% on a
 * fixed-pixel square is always a perfect circle regardless of the SVG scale.
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

  // Express the marker position as percentages of the SVG viewBox so the
  // CSS div (which is NOT inside the SVG) aligns perfectly at any width.
  const markerLeftPct = (markerX / W) * 100;
  const markerTopPct  = (markerY / H) * 100;

  return (
    <div className="relative w-full" style={{ height: `${H}px` }}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full block"
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
      </svg>

      {/*
       * Current-value marker: absolutely positioned CSS div, NOT inside the SVG.
       * Because this element lives in CSS pixel space (not SVG user space), its
       * border-radius:50% always produces a perfect circle at any container width.
       * left/top are percentages matching the SVG viewBox position of the last point.
       */}
      <div
        aria-hidden="true"
        style={{
          position:        'absolute',
          left:            `${markerLeftPct}%`,
          top:             `${markerTopPct}%`,
          width:           '10px',
          height:          '10px',
          borderRadius:    '50%',
          backgroundColor: 'var(--color-rva-blue, #264677)',
          border:          '2px solid var(--color-surface, white)',
          transform:       'translate(-50%, -50%)',
          pointerEvents:   'none',
        }}
      />
    </div>
  );
}

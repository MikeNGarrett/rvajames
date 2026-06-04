/**
 * CsoBadge — small amber circle with "!" shown when an active CSO (combined
 * sewer overflow) is upstream of a location within the past 48 hours.
 *
 * Extracted from components/tiles/RiverLevelTile.tsx 2026-06-04 so the same
 * visual treatment can be reused by LocationStatusRow (and any future tile
 * variant). The circle shape is intentionally distinct from
 * WaterQualityIcon's drop silhouette so the two indicators are
 * distinguishable by shape alone, satisfying WCAG 1.4.1 (information not
 * conveyed by color alone).
 *
 * Accessibility
 *   - aria-label on the wrapping <span> carries the full state name
 *   - title attribute provides tooltip context
 *   - The SVG itself is aria-hidden — the wrapper text alternative wins
 *
 * Size
 *   Default 12 px (w-3 h-3). For larger contexts (status rows, detail
 *   page), pass a custom size via the `size` prop.
 */

interface Props {
  /** Pixel size (square). Default 12. */
  size?: number;
}

export function CsoBadge({ size = 12 }: Props) {
  return (
    <span
      aria-label="CSO event upstream in past 48 hours"
      title="Upstream sewer overflow — bacterial levels may be elevated"
      className="inline-flex items-center shrink-0 text-status-caution-fg"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 10 10"
        width={size}
        height={size}
        fill="currentColor"
        className="flex-shrink-0"
      >
        <circle cx="5" cy="5" r="5" />
        <text
          x="5"
          y="7.8"
          textAnchor="middle"
          fontSize="7"
          fontWeight="900"
          fill="white"
        >
          !
        </text>
      </svg>
    </span>
  );
}

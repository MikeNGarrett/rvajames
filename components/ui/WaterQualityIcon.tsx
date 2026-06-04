/**
 * WaterQualityIcon — unified safe/caution water-quality indicator.
 *
 * History
 *   Replaces the inline WaterDropBadge that lived inside RiverLevelTile.tsx
 *   and the ad-hoc 💦 emoji used in RichmondConditionsSection.tsx. Logged
 *   as a follow-up 2026-06-02 after user screenshot showed the prior
 *   10×14 px drop badge was visually indistinguishable between safe and
 *   caution states — the 5 pt "!" inside the caution drop was too small
 *   to read at rendered card size.
 *
 * Design
 *   - 24×24 viewBox for clean scaling at any rendered size
 *   - Drop body fills most of the viewBox (max-visibility silhouette)
 *   - Caution state adds a large white "!" centered in the drop, at
 *     fontSize 14 → ~60% of drop interior height. Legible at 16 px.
 *   - Color signals state (blue safe / amber caution) but is reinforced
 *     by the shape distinction (! vs no !), so colorblind users + small-
 *     screen users still have a discriminator
 *
 * Accessibility
 *   - The wrapping <span> carries aria-label with the full state
 *     description, and a title attribute (tooltip on hover/long-press)
 *   - The <svg> itself is aria-hidden (the wrapper provides the text)
 *   - showLabel renders the short label inline as visible text, in
 *     which case the wrapper's aria-label is omitted (the visible text
 *     becomes the accessible name automatically)
 *
 * Sizes
 *   - size={16}  for compact tile chips (default)
 *   - size={20}  for inline status strips (Richmond Conditions)
 *   - size={28}+ for detail-page heroes
 */

interface Props {
  /** 'safe' = within VDH single-sample max; 'caution' = exceeds. */
  status: 'safe' | 'caution';
  /** Pixel size (square). Default 16. */
  size?: number;
  /** Render a short visible text label next to the icon. */
  showLabel?: boolean;
  /** Extra wrapper classes (e.g., to override gap or align). */
  className?: string;
}

const STATE = {
  safe: {
    longLabel:  'Water quality: safe',
    shortLabel: 'Water OK',
    colorClass: 'text-rva-blue',
  },
  caution: {
    longLabel:  'Water quality: elevated bacteria',
    shortLabel: 'Water caution',
    colorClass: 'text-status-caution-fg',
  },
} as const;

export function WaterQualityIcon({
  status,
  size = 16,
  showLabel = false,
  className = '',
}: Props) {
  const s = STATE[status];
  return (
    <span
      // Wrapper carries the accessible name. When showLabel is true,
      // the visible text becomes the name automatically and we omit
      // aria-label to avoid duplicate announcements.
      aria-label={showLabel ? undefined : s.longLabel}
      title={s.longLabel}
      className={`inline-flex items-center gap-1.5 shrink-0 ${s.colorClass} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        className="flex-shrink-0"
      >
        {/* Water drop body — fills most of the 24x24 viewBox */}
        <path
          d="M12 2 C10 5 4 11 4 16 a8 8 0 0 0 16 0 C20 11 14 5 12 2 Z"
          fill="currentColor"
        />
        {status === 'caution' && (
          /*
           * Large centered "!" inside the drop. The 5 pt glyph in the
           * old version was illegible at 14 px. Here at fontSize 14 on
           * a 24x24 viewBox the "!" is ~10 px tall when rendered at
           * the default 16 px size — clearly readable on a mobile tile.
           */
          <text
            x="12"
            y="20"
            textAnchor="middle"
            fontSize="14"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            fill="white"
          >
            !
          </text>
        )}
      </svg>
      {showLabel && (
        <span className="text-xs font-medium">
          {s.shortLabel}
        </span>
      )}
    </span>
  );
}

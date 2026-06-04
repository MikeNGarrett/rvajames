/**
 * LocationStatusRow — inline horizontal row of environmental status
 * indicators for a JRPS access point. Designed for the redesigned
 * RiverLevelTile (tile redesign round, 2026-06-04+).
 *
 * Renders up to two indicators side-by-side:
 *   1. Water quality — when JRA has a fresh reading mapped to this
 *      location. Uses the new shape-distinct WaterQualityIcon.
 *   2. Upstream CSO state — affirmative "No overflows upstream" when
 *      count is 0, CsoBadge + count text when count > 0. Per the
 *      tile-redesign discussion 2026-06-03, surfacing the affirmative
 *      state is valuable (reassures parents that there's nothing to
 *      worry about upstream) — not just warnings.
 *
 * Returns null when both indicators would be empty (no JRA reading AND
 * no CSO data) — trail-only locations without water-contact context
 * shouldn't render an empty bar.
 *
 * Operational status (Open / Restricted / Closed) is intentionally NOT
 * in this row. Per the 2026-06-03 design decision:
 *   - Open: pill is hidden (redundant with the lack of warnings)
 *   - Restricted: pill says "Restricted", row renders alongside
 *   - Closed: row is hidden entirely; just the closure reason renders
 *
 * So this row's job is environmental status only. The pill (StatusBadge)
 * carries operational status when applicable.
 *
 * Accessibility
 *   The row uses a <ul role="list"> with each indicator as an <li> so
 *   screen readers announce "list of N items" before reading them.
 *   Each indicator's icon already carries its own aria-label; the
 *   visible text alongside reinforces.
 */

import type { LocationSummary } from '@/lib/queries/today';
import { WaterQualityIcon } from './WaterQualityIcon';
import { CsoBadge } from './CsoBadge';

interface Props {
  waterQuality: LocationSummary['waterQuality'];
  upstreamCso:  LocationSummary['upstreamCso'];
  /**
   * When false (default), the affirmative "No overflows upstream" item
   * is rendered even when CSO count is 0. When true, only warning
   * states render — useful for very dense layouts.
   */
  hideAffirmativeCso?: boolean;
}

export function LocationStatusRow({
  waterQuality,
  upstreamCso,
  hideAffirmativeCso = false,
}: Props) {
  const csoCount = upstreamCso?.count ?? 0;
  const showWq   = waterQuality !== null;
  const showCso  = csoCount > 0 || !hideAffirmativeCso;

  if (!showWq && !showCso) return null;

  return (
    <ul
      role="list"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary"
    >
      {showWq && waterQuality && (
        <li className="inline-flex items-center gap-1.5">
          <WaterQualityIcon status={waterQuality.status} size={16} />
          <span>Water {waterQuality.status === 'safe' ? 'OK' : 'caution'}</span>
        </li>
      )}
      {showCso && (
        <li className="inline-flex items-center gap-1.5">
          {csoCount > 0 ? (
            <>
              <CsoBadge size={14} />
              <span>
                {csoCount} overflow{csoCount !== 1 ? 's' : ''} upstream
              </span>
            </>
          ) : (
            <span className="text-text-muted">No overflows upstream</span>
          )}
        </li>
      )}
    </ul>
  );
}

/**
 * FeelsLikeTile — Richmond Conditions section, primary tile #2.
 *
 * Big apparent-temperature number + 4h sparkline of upcoming feels-like
 * values, plus a heat-stress zone chip. The sparkline communicates
 * shape (rising / falling / steady) — direction in glance, not via an
 * arrow. The zone chip gives the actionable bucket (Normal / Caution /
 * Extreme / Danger / Avoid).
 *
 * A11y:
 *   - Sparkline is aria-hidden (decorative). The trend direction is
 *     announced separately via the zone chip + numeric value.
 *   - Zone color is doubled by text label so colorblind users get the
 *     same signal.
 */

import { Sparkline } from '@/components/ui/Sparkline';
import type { HeatStressZone } from '@/lib/utils/wet-bulb';

interface Props {
  apparentTempF: number;
  heatZone: HeatStressZone;
  /**
   * Optional 4h sparkline points {t, v}. v is apparent temp °F.
   * Caller computes via apparentTemperatureF() for each upcoming hour.
   */
  sparkPoints?: Array<{ t: number; v: number }>;
}

const ZONE_LABEL: Record<HeatStressZone, string> = {
  normal:  'Normal',
  caution: 'Caution',
  extreme: 'Extreme',
  danger:  'Danger',
  avoid:   'Avoid outdoor activity',
};

/**
 * Chip color follows the existing status palette but uses a custom
 * mapping for the heat-stress bands — they're a continuum, not the
 * 4-way safe/caution/danger/closed system.
 */
const ZONE_CHIP: Record<HeatStressZone, string> = {
  normal:  'bg-status-safe-subtle    text-status-safe-fg',
  caution: 'bg-status-caution-subtle text-status-caution-fg',
  extreme: 'bg-status-caution        text-status-caution-fg',
  danger:  'bg-status-danger-subtle  text-status-danger',
  avoid:   'bg-status-danger         text-status-danger-fg',
};

export function FeelsLikeTile({ apparentTempF, heatZone, sparkPoints }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Feels like
      </p>

      <p className="text-3xl font-extrabold leading-none text-text">
        {apparentTempF.toFixed(0)}
        <span className="text-base font-medium ml-0.5">°F</span>
      </p>

      {sparkPoints && sparkPoints.length >= 2 && (
        <div aria-hidden="true" className="-mx-1">
          <Sparkline points={sparkPoints} lineClass="stroke-rva-blue" height={32} />
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        <span
          className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
            ZONE_CHIP[heatZone],
          ].join(' ')}
        >
          {ZONE_LABEL[heatZone]}
        </span>
        <span className="text-xs text-text-muted">Heat stress</span>
      </div>
    </div>
  );
}

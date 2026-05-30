/**
 * CsoBanner — sub-goal 95
 *
 * Top-of-page sticky banner surfacing active or residual CSO advisory state
 * in plain language. Two visual states:
 *
 *   active   — one or more outfalls with current_overflow=true at last ingest.
 *              Red (status-danger). Signals ongoing contamination risk.
 *              role="alert" so screen readers announce immediately.
 *
 *   residual — no active discharge, but advisory window still covers today.
 *              Amber (status-caution). Signals recent elevated bacteria.
 *              role="status" (polite, non-interrupting).
 *
 * Renders null when both signals are zero — no extra gating needed at
 * the call site.
 *
 * Copy varies by age bucket so younger-child households hear stronger
 * urgency; 14+ gets the softer "consider postponing" framing.
 *
 * Sticky positioning, z-index, and color tokens match FloodBanner exactly.
 * Fully server-rendered — no JS required, no CLS.
 */

import Link from 'next/link';
import type { TodayData } from '@/lib/queries/today';
import type { AgeBucket } from '@/lib/url-state';
import { formatCsoWindowEnd } from '@/lib/utils/date-tz';

interface Props {
  cso: TodayData['cso'];
  ageBucket: AgeBucket;
}

type BannerState = 'active' | 'residual';

function resolveState(cso: TodayData['cso']): BannerState | null {
  if (cso.activelyDischarging.count > 0) return 'active';
  if (cso.advisoriesOnSelectedDate.count > 0) return 'residual';
  return null;
}

/** Build the main copy sentence(s) from state × age bucket × window end time. */
function buildMainCopy(
  state: BannerState,
  ageBucket: AgeBucket,
  windowEnd: string | null,
): string {
  const isYoung  = ageBucket === '0-2' || ageBucket === '3-5';
  const isOlder  = ageBucket === '14+';
  const endLabel = windowEnd ? formatCsoWindowEnd(windowEnd) : null;

  if (state === 'active') {
    if (isYoung) {
      return endLabel
        ? `Sewer overflow in progress. Avoid all river water contact for your kids until at least ${endLabel}. Bacterial contamination is currently elevated.`
        : 'Sewer overflow in progress. Avoid all river water contact for your kids — bacterial contamination is currently elevated.';
    }
    if (isOlder) {
      return endLabel
        ? `Sewer overflow in progress. Consider postponing water contact until ${endLabel} — bacterial levels are likely elevated.`
        : 'Sewer overflow in progress. Consider postponing water contact — bacterial levels are likely elevated.';
    }
    // 6-9, 10-13, none (no youngest child / adult default)
    return endLabel
      ? `Sewer overflow in progress. Avoid swimming, wading, and any river water contact until ${endLabel}. Bacterial contamination is elevated.`
      : 'Sewer overflow in progress. Avoid swimming, wading, and any river water contact — bacterial contamination is elevated.';
  }

  // residual
  if (isYoung) {
    return endLabel
      ? `Recent sewer overflow within the past 48 hours. Bacterial levels remain elevated through ${endLabel}. Avoid water contact with your kids until then.`
      : 'Recent sewer overflow within the past 48 hours. Bacterial levels remain elevated. Avoid water contact with your kids until the advisory clears.';
  }
  if (isOlder) {
    return endLabel
      ? `Recent sewer overflow in the past 48 hours. Bacterial levels may be elevated through ${endLabel}.`
      : 'Recent sewer overflow in the past 48 hours. Bacterial levels may be elevated.';
  }
  return endLabel
    ? `Recent sewer overflow within the past 48 hours. Bacterial levels remain elevated through ${endLabel}.`
    : 'Recent sewer overflow within the past 48 hours. Bacterial levels remain elevated.';
}

export function CsoBanner({ cso, ageBucket }: Props) {
  const state = resolveState(cso);
  if (!state) return null;

  const isActive   = state === 'active';
  const windowEnd  = cso.advisoriesOnSelectedDate.windowEndsAt;
  const hoursStale = cso.activelyDischarging.hoursStale;
  const mainCopy   = buildMainCopy(state, ageBucket, windowEnd);

  const colorClasses = isActive
    ? 'bg-status-danger text-status-danger-fg'
    : 'bg-status-caution text-status-caution-fg';

  // Stale label: available for active state (hoursStale !== null); residual
  // uses a generic cadence note since the discharge-observation staleness is
  // not meaningful when no outfall is actively discharging.
  const staleLabel = hoursStale !== null
    ? `Data as of ${hoursStale}h ago.`
    : 'Updated twice daily.';

  return (
    <div
      className={`sticky top-0 z-40 ${colorClasses} text-sm`}
      role={isActive ? 'alert' : 'status'}
    >
      <div className="max-w-prose mx-auto px-4 py-3">
        {/* Main advisory copy */}
        <p className="font-semibold leading-snug">{mainCopy}</p>

        {/* Microcopy row: staleness + learn-more link */}
        <div className="flex items-center justify-between gap-3 mt-1.5 flex-wrap">
          <span className="text-xs opacity-75">{staleLabel}</span>
          <Link
            href="/safety#cso"
            className="text-xs underline underline-offset-2 touch-target inline-flex items-center flex-shrink-0"
          >
            What&rsquo;s a combined sewer overflow? &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

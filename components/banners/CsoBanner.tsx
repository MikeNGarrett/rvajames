/**
 * CsoBanner — sub-goals 95, 97
 *
 * Top-of-page sticky banner surfacing active, residual, or forecast CSO
 * advisory state in plain language. Three visual states:
 *
 *   active    — one or more outfalls with current_overflow=true at last ingest
 *               (observed mode only). Red. role="alert" for screen readers.
 *
 *   residual  — no active discharge, but advisory window still covers today
 *               (observed mode only). Amber. role="status".
 *
 *   forecast  — the selected forecast date falls within an advisory window
 *               (forecast mode only). Amber. role="status".
 *
 * State precedence:
 *   observed → active (count > 0) → residual (advisory count > 0) → null
 *   forecast → forecast (advisory count > 0) → null
 *
 * Renders null when no active/residual/forecast signal — no gating at call site.
 *
 * Copy varies by age bucket so younger-child households hear stronger urgency;
 * 14+ gets softer "consider postponing" framing.
 *
 * Sticky positioning, z-index, and color tokens match FloodBanner exactly.
 * Fully server-rendered — no JS required, no CLS.
 */

import Link from 'next/link';
import type { TodayData } from '@/lib/queries/today';
import type { AgeBucket } from '@/lib/url-state';
import { formatCsoWindowEnd, formatSelectedDate } from '@/lib/utils/date-tz';

interface Props {
  cso: TodayData['cso'];
  ageBucket: AgeBucket;
  /** 'observed' for today (live gauge data); 'forecast' for days +1..+3. */
  mode: 'observed' | 'forecast';
  /** YYYY-MM-DD selected date — used for forecast copy ("Saturday, May 31"). */
  selectedDate: string;
}

type BannerState = 'active' | 'residual' | 'forecast';

function resolveState(
  cso: TodayData['cso'],
  mode: 'observed' | 'forecast',
): BannerState | null {
  if (mode === 'observed') {
    if (cso.activelyDischarging.count > 0) return 'active';
    if (cso.advisoriesOnSelectedDate.count > 0) return 'residual';
    return null;
  }
  // forecast mode: only show when advisory window covers the forecast date
  if (cso.advisoriesOnSelectedDate.count > 0) return 'forecast';
  return null;
}

/** Build the main copy sentence(s) from state × age bucket × window end time. */
function buildMainCopy(
  state: BannerState,
  ageBucket: AgeBucket,
  windowEnd: string | null,
  selectedDate: string,
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

  if (state === 'residual') {
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

  // forecast state
  const dateLabel = formatSelectedDate(selectedDate);
  if (isYoung) {
    return endLabel
      ? `Sewer overflow advisory will be in effect on ${dateLabel}. Avoid all river water contact with your kids until the advisory clears at ${endLabel}.`
      : `Sewer overflow advisory will be in effect on ${dateLabel}. Avoid all river water contact with your kids until the advisory clears.`;
  }
  if (isOlder) {
    return endLabel
      ? `A recent sewer overflow advisory may still be in effect on ${dateLabel}. The window clears at ${endLabel}.`
      : `A recent sewer overflow advisory may still be in effect on ${dateLabel}.`;
  }
  // 6-9, 10-13, none
  return endLabel
    ? `Sewer overflow advisory will be in effect on ${dateLabel}. Avoid water contact until the advisory clears at ${endLabel}.`
    : `Sewer overflow advisory will be in effect on ${dateLabel}. Avoid water contact until the advisory clears.`;
}

export function CsoBanner({ cso, ageBucket, mode, selectedDate }: Props) {
  const state = resolveState(cso, mode);
  if (!state) return null;

  const isActive    = state === 'active';
  const isForecast  = state === 'forecast';
  const windowEnd   = cso.advisoriesOnSelectedDate.windowEndsAt;
  const hoursStale  = cso.activelyDischarging.hoursStale;
  const mainCopy    = buildMainCopy(state, ageBucket, windowEnd, selectedDate);

  const colorClasses = isActive
    ? 'bg-status-danger text-status-danger-fg'
    : 'bg-status-caution text-status-caution-fg';

  // Stale label varies by state:
  //   active/residual (observed) → discharge observation staleness.
  //   forecast → "Forecast for {date}" — no ingest staleness applies.
  // COPY: tied to cron schedule in wrangler.jsonc — update if cron
  // cadence changes (currently 0 6,18 * * * = twice daily).
  const staleLabel = isForecast
    ? `Forecast for ${formatSelectedDate(selectedDate)}.`
    : hoursStale !== null
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

        {/* Microcopy row: staleness/forecast label + learn-more link */}
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

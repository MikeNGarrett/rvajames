/**
 * CsoBanner — sub-goals 95, 97, 97b
 *
 * Persistent top-of-page banner surfacing CURRENT (live) CSO state in plain
 * language. Two visual states:
 *
 *   active    — one or more outfalls with current_overflow=true at last ingest.
 *               Red. role="alert" for screen readers.
 *
 *   residual  — no active discharge, but today's advisory window is still in
 *               effect (observed mode only). Amber. role="status".
 *
 * State precedence:
 *   activelyDischarging.count > 0           → active  (both modes)
 *   mode=observed AND advisories cover today → residual
 *   else                                    → null (renders nothing)
 *
 * This banner always reflects LIVE conditions regardless of which date chip
 * the user has selected. Date-specific forecast CSO advisories appear in the
 * in-content block in app/page.tsx, not here.
 *
 * Renders null when no active/residual signal — no gating at call site.
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
import { formatCsoWindowEnd } from '@/lib/utils/date-tz';

interface Props {
  cso: TodayData['cso'];
  ageBucket: AgeBucket;
  /** 'observed' for today (live gauge data); 'forecast' for days +1..+3. */
  mode: 'observed' | 'forecast';
}

type BannerState = 'active' | 'residual';

/**
 * Staleness threshold for the active state. If `current_overflow_observed_at`
 * is older than this, we downgrade "active" to "residual" — we can't honestly
 * claim discharge is happening NOW based on data this stale. Live observed in
 * production 2026-05-31: the cron runs twice daily (06:00, 18:00 UTC), so by
 * the time a user visits ~10 hours after a 06:00 ingest that captured an
 * active overflow, the discharge has almost certainly stopped — but the
 * banner was confidently claiming "Sewer overflow in progress" with a tiny
 * "Data as of 9h ago" caveat. EmNet's live map disagreed.
 *
 * 2 hours matches the typical ingest cadence headroom — well under one
 * cron cycle, so a fresh active signal still gets the urgent treatment;
 * stale ones get the more honest "recent past 48 hours" framing.
 */
const ACTIVE_STALENESS_HOURS = 2;

function resolveState(
  cso: TodayData['cso'],
  mode: 'observed' | 'forecast',
): BannerState | null {
  // Active discharge is a live real-time signal — show regardless of date mode,
  // but only if the observation is recent. Stale "active" claims are worse than
  // omitted ones; they overpromise certainty we don't have.
  if (cso.activelyDischarging.count > 0) {
    const hoursStale = cso.activelyDischarging.hoursStale ?? Infinity;
    if (hoursStale <= ACTIVE_STALENESS_HOURS) return 'active';
    // Fall through — let the residual check handle it. If an advisory window
    // is still open we render residual; otherwise null (no banner).
  }
  // Residual (advisory window still in effect) is only meaningful in observed
  // mode: advisoriesOnSelectedDate covers today when mode=observed, so it
  // correctly represents "is an advisory window active right now."
  // In forecast mode, advisoriesOnSelectedDate covers the future date; using it
  // here would conflate "advisory covers tomorrow" with "advisory active today."
  if (mode === 'observed' && cso.advisoriesOnSelectedDate.count > 0) return 'residual';
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

  // residual state
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

export function CsoBanner({ cso, ageBucket, mode }: Props) {
  const state = resolveState(cso, mode);
  if (!state) return null;

  const isActive   = state === 'active';
  // For residual (observed mode), advisoriesOnSelectedDate covers today.
  // For active in forecast mode, skip the window end — it covers the forecast
  // date rather than today, and would misrepresent when the hazard clears.
  const windowEnd  = mode === 'observed' ? cso.advisoriesOnSelectedDate.windowEndsAt : null;
  const hoursStale = cso.activelyDischarging.hoursStale;
  const mainCopy   = buildMainCopy(state, ageBucket, windowEnd);

  const colorClasses = isActive
    ? 'bg-status-danger text-status-danger-fg'
    : 'bg-status-caution text-status-caution-fg';

  // Staleness label reflects ingest freshness (same for active and residual).
  // COPY: tied to cron schedule in wrangler.jsonc — update if cron
  // cadence changes (currently 0 6,18 * * * = twice daily).
  const staleLabel = hoursStale !== null
    ? `Data as of ${hoursStale}h ago.`
    : 'Updated twice daily.';

  return (
    <div
      className={`sticky top-0 z-40 ${colorClasses} text-sm`}
      role={isActive ? 'alert' : 'status'}
    >
      <div className="max-w-lg sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 py-3">
        {/* Main advisory copy */}
        <p className="font-semibold leading-snug">{mainCopy}</p>

        {/* Microcopy row: staleness label + learn-more link */}
        <div className="flex items-center justify-between gap-3 mt-1.5 flex-wrap">
          {/*
           * Bare text-xs without opacity — opacity-75 dropped the brown-on-
           * amber pair from 7.9:1 (AAA) to 4.2:1 (sub-AA) per Lighthouse a11y
           * audit 2026-05-31. Sub-goal 79 already removed an opacity-70 from
           * the chip subtitles for the same reason. Visual hierarchy here
           * comes from size (text-xs) + position (below the main copy), not
           * from transparency.
           */}
          <span className="text-xs">{staleLabel}</span>
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

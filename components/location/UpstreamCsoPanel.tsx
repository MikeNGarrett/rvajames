/**
 * UpstreamCsoPanel — sub-goals 84, 96, 97
 *
 * Displays upstream CSO (combined sewer overflow) advisory state for a river
 * access point. Rendered only when count > 0; callers should not render it when
 * upstreamCso is null.
 *
 * Copy is mode-aware (observed vs. forecast) and age-bucket-aware:
 *   observed: "{N} sewer overflow{s} upstream of this location in the past 48 hours."
 *             + action line that varies by age bucket.
 *   forecast: "{N} sewer overflow advisor{y/ies} from upstream will still be in
 *             effect on {selectedDate-formatted}." + action line.
 *
 * Age-bucket action line:
 *   0-2/3-5:   "Avoid all water contact with your kids — bacterial contamination
 *               may be elevated downstream."
 *   6-9/10-13: "Avoid swimming and wading — bacterial contamination may be
 *               elevated downstream."
 *   14+/none:  "Bacterial contamination may be elevated downstream — consider
 *               postponing water contact."
 *
 * Pattern mirrors WaterQualityPanel: section with h2 heading and amber caution block.
 * Data source: Richmond DPU overflow events via EmNet public map.
 * No AI — all content is deterministic from the advisory rows.
 */

import type { UpstreamCsoSignal } from '@/lib/safety/upstream-cso';
import type { AgeBucket } from '@/lib/url-state';
import { formatSelectedDate } from '@/lib/utils/date-tz';

interface Props {
  upstreamCso: UpstreamCsoSignal;
  /** 'observed' for today (live window); 'forecast' for advisory window coverage. */
  mode: 'observed' | 'forecast';
  /** Age bucket of the youngest family member — drives tone of action copy. */
  ageBucket: AgeBucket;
  /**
   * YYYY-MM-DD selected date — required for forecast copy ("Saturday, May 31").
   * undefined is safe (fallback to "the forecast date") but should always be
   * supplied from the location page.
   */
  selectedDate?: string;
}

/** Builds the amber-block paragraph content from signal × mode × age bucket. */
function buildCsoCopy(
  count: number,
  mode: 'observed' | 'forecast',
  ageBucket: AgeBucket,
  selectedDate: string | undefined,
): string {
  const isYoung = ageBucket === '0-2' || ageBucket === '3-5';
  const isAdult = ageBucket === '14+' || ageBucket === 'none';

  // Age-specific action line (shared between observed and forecast)
  const actionLine = isYoung
    ? 'Avoid all water contact with your kids — bacterial contamination may be elevated downstream.'
    : isAdult
    ? 'Bacterial contamination may be elevated downstream — consider postponing water contact.'
    : 'Avoid swimming and wading — bacterial contamination may be elevated downstream.';

  if (mode === 'forecast') {
    const dateLabel = selectedDate ? formatSelectedDate(selectedDate) : 'the forecast date';
    const advisoryWord = count !== 1 ? 'advisories' : 'advisory';
    return `${count} sewer overflow ${advisoryWord} from upstream will still be in effect on ${dateLabel}. ${actionLine}`;
  }

  // observed mode
  const overflow = `${count} sewer overflow${count !== 1 ? 's' : ''}`;
  return `${overflow} upstream of this location in the past 48 hours. ${actionLine}`;
}

export function UpstreamCsoPanel({ upstreamCso, mode, ageBucket, selectedDate }: Props) {
  // Callers pass a non-null signal; defensive early exit for count === 0.
  if (upstreamCso.count === 0) return null;

  const { count } = upstreamCso;
  const copy = buildCsoCopy(count, mode, ageBucket, selectedDate);

  return (
    <section
      aria-labelledby="cso-heading"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
    >
      <h2
        id="cso-heading"
        className="text-sm font-semibold text-text-secondary mb-1 uppercase tracking-wide"
      >
        Upstream Sewer Overflow
      </h2>

      {/* Amber caution block */}
      <div className="rounded-lg bg-status-caution/10 border border-status-caution/30 p-3 mb-4 text-sm">
        <p className="text-status-caution-fg font-medium">
          {copy}
        </p>
      </div>

      {/* Attribution */}
      <p className="text-xs text-text-muted">
        Overflow data from{' '}
        <a
          href="https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Richmond DPU via EmNet<span className="sr-only"> (opens in new tab)</span>
        </a>
        . Upstream determination is approximate (longitude-based). Data is updated
        periodically — check EmNet for the most current status.
      </p>
    </section>
  );
}

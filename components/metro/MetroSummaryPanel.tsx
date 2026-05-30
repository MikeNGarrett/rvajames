/**
 * Renders the AI-generated metro river summary.
 * This component is wrapped in <Suspense> on the homepage — it fetches + optionally
 * generates the summary lazily on first visit for a given (date, age_bucket) combo.
 */

import Link from 'next/link';
import { getMetroSummary } from '@/lib/queries/metro-summary';
import { resolveDateMode, formatForecastDate } from '@/lib/queries/date-range';
import { ForecastModeIndicator } from '@/components/forecast/ForecastModeIndicator';
import { RiverWideActivityGrid } from './RiverWideActivityGrid';
import type { AgeBucket } from '@/lib/url-state';

interface Props {
  date: string;
  ageBucket: AgeBucket;
}

export async function MetroSummaryPanel({ date, ageBucket }: Props) {
  const { summary } = await getMetroSummary(date, ageBucket);
  const { mode, forecastConfidence } = resolveDateMode(date);
  const dateLabel = mode === 'forecast' ? formatForecastDate(date) : null;

  if (!summary) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 mb-4 text-sm text-text-muted">
        River summary unavailable — check gauge readings above for current conditions.
      </div>
    );
  }

  return (
    <section aria-label="River conditions summary" className="rounded-xl border border-border bg-surface-raised p-4 mb-4" style={{ viewTransitionName: 'metro-summary' }}>
      {mode === 'forecast' && dateLabel ? (
        <>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Forecast for {dateLabel}
          </p>
          <ForecastModeIndicator mode={mode} forecastConfidence={forecastConfidence} />
        </>
      ) : null}
      <p className={`text-base font-semibold text-text mb-2${mode === 'forecast' ? ' mt-2' : ''}`}>{summary.headline}</p>

      {/* Body markdown rendered as plain text (strips Markdown syntax) */}
      <p className="text-sm text-text-secondary leading-relaxed mb-3 max-w-prose">
        {summary.body_md.replace(/[*#`]/g, '').replace(/\n+/g, ' ').trim()}
      </p>

      {/* River-wide activity grid — only present on b2+ rows */}
      {summary.activities?.length ? (
        <RiverWideActivityGrid activities={summary.activities} />
      ) : null}

      {/* Top concerns */}
      {summary.top_concerns.length > 0 && (
        <ul className="mb-3 space-y-1">
          {summary.top_concerns.map((concern, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-status-caution-fg">
              <span aria-hidden className="mt-0.5 flex-shrink-0">⚠</span>
              {concern}
            </li>
          ))}
        </ul>
      )}

      {/* Best bets */}
      {summary.best_bets_today.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Best bets today
          </p>
          <ul className="space-y-1.5">
            {summary.best_bets_today.map((bet) => (
              <li key={bet.location_slug}>
                <Link
                  href={`/locations/${bet.location_slug}?date=${date}&age=${encodeURIComponent(ageBucket)}`}
                  className="flex items-center justify-between gap-2 touch-target group"
                >
                  <div>
                    <span className="font-medium text-rva-blue capitalize group-hover:underline">
                      {bet.location_slug.replace(/-/g, ' ')}
                    </span>
                    <span className="text-xs text-text-muted ml-2">{bet.reason}</span>
                  </div>
                  <span className="text-rva-blue text-sm flex-shrink-0" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-text-muted italic mt-3">
        AI-generated from USGS sensor data · use your own judgment on the water
      </p>

      {/* Speculation rules — prefetch + prerender the best-bet location pages
          so they load instantly when the user taps a best-bet link.
          guide: improve-next-page-load-performance */}
      {summary.best_bets_today.length > 0 && (
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prefetch: [{
                urls: summary.best_bets_today.map((b) => `/locations/${b.location_slug}`),
                eagerness: 'eager',
              }],
              prerender: [{
                urls: summary.best_bets_today.map((b) => `/locations/${b.location_slug}`),
                eagerness: 'moderate',
              }],
            }),
          }}
        />
      )}
    </section>
  );
}

/** Skeleton shown while MetroSummaryPanel is generating */
export function MetroSummaryPanelSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4 mb-4 animate-pulse motion-reduce:animate-none min-h-[300px]">
      <div className="h-4 bg-surface rounded w-3/4 mb-3" />
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-5/6" />
        <div className="h-3 bg-surface rounded w-4/6" />
      </div>
      <div className="h-3 bg-surface rounded w-2/3" />
    </div>
  );
}

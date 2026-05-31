'use client';

/**
 * MetroSummaryPanel — client component that fetches the AI metro summary
 * after the deterministic homepage content paints (sub-goal 65).
 *
 * Architecture:
 *   - The wrapper (this file's default export) is a client component that
 *     drops <LazyContent> around the panel content, pointing at the new
 *     /api/metro-summary route.
 *   - The actual rendered markup lives in `MetroSummaryContent` below — a
 *     plain function component called by LazyContent's `children` prop on
 *     success.
 *   - `MetroSummaryPanelSkeleton` is the placeholder during initial fetch.
 *
 * Why move this off the server-render hot path:
 *   The browser's `load` event used to wait for the AI stream to finish
 *   inside a <Suspense> boundary — 3-8s on cold cache. After this migration,
 *   the deterministic content paints + the load event fires immediately,
 *   then the AI panel fills in afterward with explicit loading affordances
 *   (skeleton, spinner, status text, stale-while-revalidate on filter change).
 *
 * Filter change UX:
 *   When date or age changes, the URL prop flips, LazyContent aborts the
 *   in-flight fetch, and the prior summary stays visible at 60% opacity
 *   with a small inline spinner in the top-right while the new fetch runs.
 *   No skeleton flash on filter change — only on first mount.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { LazyContent } from '@/components/ui/LazyContent';
import {
  MetroSummarySchema,
  type MetroSummary,
} from '@/lib/ai/prompts/summarize-metro';
import { resolveDateMode, formatForecastDate } from '@/lib/queries/date-range';
import { ForecastModeIndicator } from '@/components/forecast/ForecastModeIndicator';
import { RiverWideActivityGrid } from './RiverWideActivityGrid';
import type { AgeBucket } from '@/lib/url-state';

interface Props {
  date: string;
  ageBucket: AgeBucket;
}

/**
 * Parse function for the /api/metro-summary response. The route wraps the
 * summary in { summary, source } — we drop `source` (presentation doesn't
 * use it) and validate the inner shape against the canonical schema.
 */
function parseMetroSummaryResponse(raw: unknown): MetroSummary {
  const r = raw as { summary?: unknown };
  if (!r?.summary) {
    throw new Error('Missing summary field in API response');
  }
  return MetroSummarySchema.parse(r.summary);
}

export function MetroSummaryPanel({ date, ageBucket }: Props) {
  // encodeURIComponent on age to round-trip '14+' through the URL safely
  // (same reason as the navigation hrefs — '+' decodes to a space without it).
  // useMemo so the URL string identity is stable across re-renders that
  // don't change date/age — otherwise LazyContent's effect dep would re-fire
  // on every parent render.
  const url = useMemo(
    () => `/api/metro-summary?date=${date}&age=${encodeURIComponent(ageBucket)}`,
    [date, ageBucket],
  );

  // Header is computed + rendered server-side so the panel area has a
  // stable, text-bearing LCP candidate in the initial HTML. Before this,
  // the panel area in the initial paint was just skeleton bars (no text
  // content), so Chrome's LCP shifted to the AI-fetched content when it
  // arrived (causing a ~3.7s LCP / Performance 88 on the homepage).
  // With this header in the initial paint, LCP anchors to a deterministic
  // element near TTFB.
  const { mode, forecastConfidence } = resolveDateMode(date);
  const dateLabel = mode === 'forecast' ? formatForecastDate(date) : null;

  return (
    <section
      aria-label="River conditions summary"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
      style={{ viewTransitionName: 'metro-summary' }}
    >
      {/*
       * Header is the LCP anchor — must paint from the initial server-rendered
       * HTML, regardless of AI fetch state. Forecast mode shows a longer
       * "Forecast for [date]" + confidence indicator; observed mode keeps a
       * subtle "Conditions summary" eyebrow.
       */}
      {mode === 'forecast' && dateLabel ? (
        <>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Forecast for {dateLabel}
          </p>
          <ForecastModeIndicator mode={mode} forecastConfidence={forecastConfidence} />
        </>
      ) : (
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
          Conditions summary
        </p>
      )}

      <LazyContent
        url={url}
        parse={parseMetroSummaryResponse}
        skeleton={<MetroSummaryPanelSkeleton />}
        statusText="Generating recommendations…"
        spinnerLabel="Loading metro summary"
      >
        {(summary) => (
          <MetroSummaryContent
            summary={summary}
            date={date}
            ageBucket={ageBucket}
            mode={mode}
          />
        )}
      </LazyContent>
    </section>
  );
}

/**
 * Pure render layer for the parsed metro summary. Called by LazyContent on
 * success. Carries no state of its own; same JSX as the pre-migration
 * server component, just receiving `summary` directly instead of awaiting it.
 */
function MetroSummaryContent({
  summary,
  date,
  ageBucket,
  mode,
}: {
  summary: MetroSummary;
  date: string;
  ageBucket: AgeBucket;
  mode: ReturnType<typeof resolveDateMode>['mode'];
}) {
  return (
    <>
      <p className={`text-base font-semibold text-text mb-2${mode === 'forecast' ? ' mt-2' : ''}`}>
        {summary.headline}
      </p>

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

      {/*
       * Speculation rules: prefetch + prerender best-bet location pages so
       * they load instantly when the user taps a best-bet link. After the
       * migration these get injected into the DOM AFTER the AI fetch
       * completes — the browser still honours them when added dynamically.
       * guide: improve-next-page-load-performance
       */}
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
    </>
  );
}

/**
 * Skeleton shown while MetroSummaryPanel is fetching for the first time.
 * min-h-300 matches the typical filled-panel height to avoid CLS
 * (per audit Finding 2). LazyContent wraps this in <SkeletonShimmer> at
 * render time, so the gradient sweep overlays automatically — no need to
 * add it here.
 */
export function MetroSummaryPanelSkeleton() {
  // No outer chrome (rounded-xl / border / bg / padding / mb) — the parent
  // <section> in MetroSummaryPanel already provides it. The skeleton renders
  // inside that section as placeholder bars only. min-h preserves CLS-safe
  // height while the AI fetch resolves.
  return (
    <div className="animate-pulse motion-reduce:animate-none min-h-[260px]">
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

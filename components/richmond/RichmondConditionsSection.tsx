/**
 * RichmondConditionsSection — sub-goal 88.
 *
 * The new at-a-glance "is today a good day at the river?" panel that
 * sits above the river-specific gauge panel. Answers the four parent
 * questions from the plan: swim today? how prepared? stay home? trend?
 *
 * Layout (mobile baseline at 375px):
 *
 *   RICHMOND CONDITIONS  ◀─ small uppercase eyebrow
 *
 *   Great day to head out  ◀─ deterministic headline (LCP candidate)
 *
 *   ┌──────────┐ ┌──────────┐ ┌──────────┐
 *   │ Swim    │ │ Feels    │ │ Next 4h  │
 *   │ Today   │ │ Like     │ │          │
 *   └──────────┘ └──────────┘ └──────────┘
 *
 *   💧 Water 72°F · 💦 Quality OK · ☀ UV 7 (high) · 🌫 Happiness 82
 *
 *   [AI microcopy here]    ◀─ LazyContent: /api/metro-summary
 *                              consumes richmond_microcopy when present.
 *                              Rendered at the bottom (below fold on
 *                              most mobile viewports) so it's NOT an
 *                              LCP candidate — see LCP note below.
 *
 * Data
 *   - `data` (typed RichmondConditionsData) is built server-side by the
 *     page from rules-engine outputs + snapshot data. Sub-goal 90 wires
 *     the resolver into app/page.tsx; sub-goal 88 only takes it as a prop.
 *   - AI microcopy fetches /api/metro-summary on mount (per kickoff
 *     decision: "Independent LazyContent per consumer"). Until sub-goal
 *     89 ships richmond_microcopy on MetroSummary, the field is absent
 *     and we render only the deterministic headline + tiles. Graceful
 *     degrade — section is fully usable without AI.
 *
 * LCP note (sub-goal 91 revision)
 *   Sub-goal 88 placed the headline (text-xl) above the AI microcopy
 *   paragraph. Live Lighthouse against prod showed that the ~140-char
 *   microcopy at text-sm (3 lines × ~340 px wide ≈ 23k sq px) was a
 *   larger painted element than the headline (text-xl × 1-2 lines
 *   ≈ 10k sq px). When /api/metro-summary resolved ~9 s into the page
 *   load, the microcopy paragraph became the new LCP element — 15 s
 *   observed, 4 s simulated. Both bad.
 *
 *   The fix is two-pronged:
 *
 *   1. Bump the headline to `text-3xl sm:text-4xl font-extrabold
 *      text-balance` so it's both visually dominant and larger in
 *      pixel area. `text-balance` keeps short headlines like
 *      "Stay home today" from looking like a forlorn single thin line.
 *
 *   2. Move the AI microcopy to the BOTTOM of the section, after the
 *      tiles and stats strip. On a 375x667 mobile viewport, the
 *      microcopy now renders ~700 px from the top of the page (below
 *      the fold) and is therefore not eligible as an LCP candidate at
 *      all. The headline remains the only above-fold contentful
 *      element competing for LCP.
 *
 *   UX trade-off: the AI elaboration is no longer immediately under
 *   the headline. Acceptable because (a) the deterministic headline
 *   already conveys the essential message in plain English, (b) the
 *   microcopy is supplementary context, and (c) the alternative is a
 *   user-perceived LCP of 9-15 s that tanks the Performance score and
 *   genuinely feels slow.
 */

'use client';

import { useMemo } from 'react';
import { Sparkline } from '@/components/ui/Sparkline';
import { HorizontalGauge } from '@/components/ui/HorizontalGauge';
import { LazyContent } from '@/components/ui/LazyContent';
import { WaterQualityIcon } from '@/components/ui/WaterQualityIcon';
import { SwimTodayTile } from './SwimTodayTile';
import { FeelsLikeTile } from './FeelsLikeTile';
import { NextHoursTile } from './NextHoursTile';
import type {
  SwimTodayResult,
  HappinessIndexResult,
  NextHoursOutlook,
} from '@/lib/safety/rules';
import type { HeatStressZone } from '@/lib/utils/wet-bulb';
import type { AgeBucket } from '@/lib/url-state';

/** Deterministic data slice consumed by the section (built server-side). */
export interface RichmondConditionsData {
  /** Deterministic headline string from headlineForRichmondConditions(). */
  headline:        string;
  swim:            SwimTodayResult;
  happiness:       HappinessIndexResult;
  apparentTempF:   number;
  heatZone:        HeatStressZone;
  outlook:         NextHoursOutlook;
  waterTempF:      number | null;
  /**
   * JRA water-quality summary status. null when no fresh reading.
   * 'safe' = within VDH single-sample max; 'caution' = exceeds.
   */
  waterQualityStatus: 'safe' | 'caution' | null;
  /** Current UV index 0–11+. null when Open-Meteo unreachable last cron. */
  uv:              number | null;
  /** 4h apparent-temp sparkline {t, v} pairs. Optional. */
  feelsLikeSparkPoints?: Array<{ t: number; v: number }>;
}

interface Props {
  date:      string;
  ageBucket: AgeBucket;
  data:      RichmondConditionsData;
}

/** UV descriptor per WHO + EPA bands. */
function uvDescriptor(uv: number): string {
  if (uv >= 11) return 'extreme';
  if (uv >=  8) return 'very high';
  if (uv >=  6) return 'high';
  if (uv >=  3) return 'moderate';
  return 'low';
}

/**
 * Read richmond_microcopy from the API response. Tolerates the field
 * being absent (sub-goal 89 introduces it; before then the value is
 * undefined and we render nothing).
 */
function parseMicrocopy(raw: unknown): string | null {
  const r = raw as { summary?: { richmond_microcopy?: unknown } };
  const v = r?.summary?.richmond_microcopy;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function RichmondConditionsSection({ date, ageBucket, data }: Props) {
  // Stable URL so LazyContent's effect doesn't re-fire on parent re-render.
  const microcopyUrl = useMemo(
    () => `/api/metro-summary?date=${date}&age=${encodeURIComponent(ageBucket)}`,
    [date, ageBucket],
  );

  return (
    <section
      aria-labelledby="richmond-conditions-heading"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
    >
      <h2
        id="richmond-conditions-heading"
        className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2"
      >
        Richmond conditions
      </h2>

      {/* Deterministic headline — LCP candidate. See LCP note in file header. */}
      <p className="text-3xl sm:text-4xl font-extrabold leading-tight text-balance text-text mb-3">
        {data.headline}
      </p>

      {/* Three primary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <SwimTodayTile result={data.swim} waterTempF={data.waterTempF} />
        <FeelsLikeTile
          apparentTempF={data.apparentTempF}
          heatZone={data.heatZone}
          sparkPoints={data.feelsLikeSparkPoints}
        />
        <NextHoursTile outlook={data.outlook} />
      </div>

      {/* Secondary inline strip */}
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary border-t border-border pt-3">
        {data.waterTempF !== null && (
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true">💧</span>
            <dt className="sr-only">Water temperature</dt>
            <dd>Water {data.waterTempF.toFixed(0)}°F</dd>
          </div>
        )}
        {data.waterQualityStatus !== null && (
          <div className="flex items-center gap-1.5">
            <WaterQualityIcon status={data.waterQualityStatus} size={18} />
            <dt className="sr-only">Water quality</dt>
            <dd
              className={
                data.waterQualityStatus === 'caution' ? 'text-status-caution-fg font-medium' : ''
              }
            >
              Quality {data.waterQualityStatus === 'safe' ? 'OK' : 'caution'}
            </dd>
          </div>
        )}
        {data.uv !== null && (
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true">☀</span>
            <dt className="sr-only">UV index</dt>
            <dd>
              UV {data.uv.toFixed(0)} ({uvDescriptor(data.uv)})
            </dd>
          </div>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <span aria-hidden="true">🌈</span>
          <dt className="sr-only">Happiness index</dt>
          <dd className="flex items-center gap-2 flex-1">
            <span className="whitespace-nowrap">
              Happiness {data.happiness.score}
            </span>
            <div className="flex-1 max-w-[120px]">
              <HorizontalGauge
                value={data.happiness.score}
                min={0}
                max={100}
                normalBand={{ low: 60, high: 100 }}
                ariaLabel={`Happiness ${data.happiness.score} of 100 — ${data.happiness.bandLabel}`}
              />
            </div>
          </dd>
        </div>
      </dl>

      {/*
       * AI microcopy — fetched client-side; renders nothing if absent (pre-89).
       *
       * Deliberately placed last in the section so it falls below the
       * fold on most mobile viewports and is therefore NOT an LCP
       * candidate. See LCP note in file header for the rationale.
       */}
      <LazyContent
        url={microcopyUrl}
        parse={parseMicrocopy}
        skeleton={<MicrocopySkeleton />}
        spinnerLabel="Loading conditions context"
      >
        {(text) =>
          text ? (
            <p className="text-sm text-text-secondary leading-relaxed mt-4 max-w-prose">
              {text}
            </p>
          ) : null
        }
      </LazyContent>
    </section>
  );
}

/** Skeleton placeholder for the AI microcopy section. */
function MicrocopySkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none mt-4 space-y-1.5">
      <div className="h-3 bg-surface rounded w-5/6" />
      <div className="h-3 bg-surface rounded w-4/6" />
    </div>
  );
}

/**
 * Re-export the Sparkline so callers can pre-build sparkline data
 * with the same primitive the tile uses. Avoids a duplicate import
 * path in the data-resolver layer.
 */
export { Sparkline };

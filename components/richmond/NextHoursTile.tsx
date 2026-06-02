/**
 * NextHoursTile — Richmond Conditions section, primary tile #3.
 *
 * Glanceable 4-hour outlook: sky emoji + descriptor, precipitation
 * summary, temperature trend. Reads pre-computed values from the
 * NextHoursOutlook produced by lib/safety/rules nextHoursOutlook().
 *
 * A11y:
 *   - Emoji is aria-hidden; the descriptor text carries the meaning.
 *   - Trend uses both word ("Warming") and arrow — colorblind-safe.
 */

import type { NextHoursOutlook } from '@/lib/safety/rules';

interface Props {
  outlook: NextHoursOutlook;
}

const SKY_EMOJI: Record<NextHoursOutlook['skyCover'], string> = {
  'clear':         '☀',
  'partly':        '⛅',
  'mostly cloudy': '🌥',
  'overcast':      '☁',
};

const SKY_LABEL: Record<NextHoursOutlook['skyCover'], string> = {
  'clear':         'Clear',
  'partly':        'Partly cloudy',
  'mostly cloudy': 'Mostly cloudy',
  'overcast':      'Overcast',
};

const TREND_ARROW: Record<NextHoursOutlook['temperatureTrend'], string> = {
  rising:  '↗',
  falling: '↘',
  steady:  '→',
};

const TREND_LABEL: Record<NextHoursOutlook['temperatureTrend'], string> = {
  rising:  'Warming',
  falling: 'Cooling',
  steady:  'Steady',
};

export function NextHoursTile({ outlook }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Next 4h
      </p>

      <p className="text-2xl font-extrabold leading-none text-text flex items-center gap-2">
        <span aria-hidden="true">{SKY_EMOJI[outlook.skyCover]}</span>
        <span className="text-lg font-semibold">{SKY_LABEL[outlook.skyCover]}</span>
      </p>

      <p className="text-sm text-text">{outlook.precipitationSummary}</p>

      {outlook.precipitationChance >= 20 && (
        <p className="text-xs text-text-muted">
          {outlook.precipitationChance}% chance of precipitation
        </p>
      )}

      <p className="text-xs text-text-muted mt-auto flex items-center gap-1">
        <span aria-hidden="true">{TREND_ARROW[outlook.temperatureTrend]}</span>
        <span>{TREND_LABEL[outlook.temperatureTrend]}</span>
      </p>
    </div>
  );
}

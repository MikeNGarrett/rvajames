/**
 * SSR tests for the Richmond Conditions tiles + section orchestrator.
 *
 * Project convention is renderToStaticMarkup against synthetic props
 * (no jsdom, no RTL). The section's interactive bits (LazyContent
 * fetch state, <details> toggle) are exercised in their own tests
 * — see lib/safety/rules.test.ts for the decision logic and
 * components/ui/LazyContent.test.tsx for the wrapper's state machine.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SwimTodayTile } from './SwimTodayTile';
import { FeelsLikeTile } from './FeelsLikeTile';
import { NextHoursTile } from './NextHoursTile';
import {
  RichmondConditionsSection,
  type RichmondConditionsData,
} from './RichmondConditionsSection';
import type {
  SwimTodayResult,
  HappinessIndexResult,
  NextHoursOutlook,
} from '@/lib/safety/rules';

// ── Shared test data ──────────────────────────────────────────────────────────

const swimRecommended: SwimTodayResult = {
  status:              'recommended',
  primaryReason:       'Water is 75°F — comfortable for swimming.',
  contributingReasons: ['Water is 75°F — comfortable for swimming.'],
};

const swimWadeNullTemp: SwimTodayResult = {
  status:              'wade',
  primaryReason:       'Water temperature unavailable — wade with caution.',
  contributingReasons: ['Water temperature unavailable — wade with caution.'],
};

const swimAvoidStacked: SwimTodayResult = {
  status:              'avoid',
  primaryReason:       'River at flood stage — strong currents and submerged hazards.',
  contributingReasons: [
    'River at flood stage — strong currents and submerged hazards.',
    'Bacterial water-quality advisory in effect.',
    'Sewer overflow in the past 48 hours — bacterial contamination likely.',
  ],
};

const happinessExcellent: HappinessIndexResult = {
  score:     85,
  band:      'excellent',
  bandLabel: 'Excellent day for the river',
};

const outlookClear: NextHoursOutlook = {
  precipitationChance:  10,
  precipitationSummary: 'No rain expected',
  skyCover:             'clear',
  temperatureTrend:     'rising',
  apparentTempTrend:    'rising',
  series:               [],
};

const outlookRainy: NextHoursOutlook = {
  precipitationChance:  75,
  precipitationSummary: 'Rain likely',
  skyCover:             'mostly cloudy',
  temperatureTrend:     'falling',
  apparentTempTrend:    'falling',
  series:               [],
};

// ─── SwimTodayTile ────────────────────────────────────────────────────────────

describe('SwimTodayTile', () => {
  it('renders the status label, primary reason, and water temp', () => {
    const html = renderToStaticMarkup(
      <SwimTodayTile result={swimRecommended} waterTempF={75} />,
    );
    expect(html).toContain('Swim today');
    expect(html).toContain('Recommended');
    expect(html).toContain('comfortable for swimming');
    expect(html).toContain('Water 75°F');
  });

  it('uses safe-status semantic colors for recommended swim', () => {
    const html = renderToStaticMarkup(
      <SwimTodayTile result={swimRecommended} waterTempF={75} />,
    );
    expect(html).toContain('bg-status-safe');
    expect(html).not.toContain('bg-status-danger');
  });

  it('uses caution colors for wade status', () => {
    const html = renderToStaticMarkup(
      <SwimTodayTile result={swimWadeNullTemp} waterTempF={null} />,
    );
    expect(html).toContain('Wade only');
    expect(html).toContain('bg-status-caution');
    // No water temp line when null
    expect(html).not.toContain('Water null');
  });

  it('uses danger colors for avoid status', () => {
    const html = renderToStaticMarkup(
      <SwimTodayTile result={swimAvoidStacked} waterTempF={50} />,
    );
    expect(html).toContain('Avoid');
    expect(html).toContain('bg-status-danger');
  });

  it('wraps the reason in <details> when multiple contributing reasons exist', () => {
    const html = renderToStaticMarkup(
      <SwimTodayTile result={swimAvoidStacked} waterTempF={50} />,
    );
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    // All contributing reasons should be in the markup
    expect(html).toContain('Bacterial water-quality advisory');
    expect(html).toContain('Sewer overflow');
  });

  it('renders plain <p> reason (no details) when only one reason', () => {
    const html = renderToStaticMarkup(
      <SwimTodayTile result={swimRecommended} waterTempF={75} />,
    );
    expect(html).not.toContain('<details');
  });
});

// ─── FeelsLikeTile ────────────────────────────────────────────────────────────

describe('FeelsLikeTile', () => {
  it('renders apparent temp number and Heat stress label', () => {
    const html = renderToStaticMarkup(
      <FeelsLikeTile apparentTempF={78} heatZone="normal" />,
    );
    expect(html).toContain('Feels like');
    expect(html).toContain('78');
    expect(html).toContain('Heat stress');
    expect(html).toContain('Normal');
  });

  it('caution zone uses caution-subtle colors', () => {
    const html = renderToStaticMarkup(
      <FeelsLikeTile apparentTempF={88} heatZone="caution" />,
    );
    expect(html).toContain('Caution');
    expect(html).toContain('bg-status-caution-subtle');
  });

  it('danger zone uses danger colors', () => {
    const html = renderToStaticMarkup(
      <FeelsLikeTile apparentTempF={102} heatZone="danger" />,
    );
    expect(html).toContain('Danger');
    expect(html).toContain('text-status-danger');
  });

  it('renders Sparkline when sparkPoints provided with ≥ 2 points', () => {
    const sparkPoints = [
      { t: 1717000000000, v: 78 },
      { t: 1717003600000, v: 79 },
      { t: 1717007200000, v: 80 },
      { t: 1717010800000, v: 80 },
    ];
    const html = renderToStaticMarkup(
      <FeelsLikeTile apparentTempF={80} heatZone="normal" sparkPoints={sparkPoints} />,
    );
    expect(html).toContain('<svg');
    expect(html).toContain('aria-hidden');
  });

  it('omits Sparkline when sparkPoints absent', () => {
    const html = renderToStaticMarkup(
      <FeelsLikeTile apparentTempF={80} heatZone="normal" />,
    );
    expect(html).not.toContain('<svg');
  });
});

// ─── NextHoursTile ────────────────────────────────────────────────────────────

describe('NextHoursTile', () => {
  it('renders sky descriptor + precip summary + trend', () => {
    const html = renderToStaticMarkup(<NextHoursTile outlook={outlookClear} />);
    expect(html).toContain('Next 4h');
    expect(html).toContain('Clear');
    expect(html).toContain('No rain expected');
    expect(html).toContain('Warming');
  });

  it('falling trend reads "Cooling"', () => {
    const html = renderToStaticMarkup(<NextHoursTile outlook={outlookRainy} />);
    expect(html).toContain('Cooling');
    expect(html).toContain('Mostly cloudy');
    expect(html).toContain('Rain likely');
  });

  it('shows precip chance percent when ≥ 20%', () => {
    const html = renderToStaticMarkup(<NextHoursTile outlook={outlookRainy} />);
    expect(html).toContain('75% chance of precipitation');
  });

  it('hides precip chance percent when < 20%', () => {
    const html = renderToStaticMarkup(<NextHoursTile outlook={outlookClear} />);
    expect(html).not.toContain('% chance');
  });
});

// ─── RichmondConditionsSection ────────────────────────────────────────────────

const baseData: RichmondConditionsData = {
  headline:           'Great day to head out',
  swim:               swimRecommended,
  happiness:          happinessExcellent,
  apparentTempF:      78,
  heatZone:           'normal',
  outlook:            outlookClear,
  waterTempF:         75,
  waterQualityStatus: 'safe',
  uv:                 7,
};

describe('RichmondConditionsSection', () => {
  it('renders the section landmark with the right aria-labelled heading', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection date="2026-06-02" ageBucket="6-9" data={baseData} />,
    );
    expect(html).toContain('aria-labelledby="richmond-conditions-heading"');
    expect(html).toContain('id="richmond-conditions-heading"');
    expect(html).toContain('Richmond conditions');
  });

  it('renders the deterministic headline as a prominent text node', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection date="2026-06-02" ageBucket="6-9" data={baseData} />,
    );
    expect(html).toContain('Great day to head out');
  });

  it('renders all three primary tiles', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection date="2026-06-02" ageBucket="6-9" data={baseData} />,
    );
    expect(html).toContain('Swim today');
    expect(html).toContain('Feels like');
    expect(html).toContain('Next 4h');
  });

  it('renders the secondary strip stats when data present', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection date="2026-06-02" ageBucket="6-9" data={baseData} />,
    );
    expect(html).toContain('Water 75°F');
    expect(html).toContain('Quality OK');
    expect(html).toContain('UV 7');
    expect(html).toContain('high'); // UV descriptor
    expect(html).toContain('Happiness 85');
  });

  it('omits the water-temp inline stat when null (no fresh reading)', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection
        date="2026-06-02"
        ageBucket="6-9"
        data={{ ...baseData, waterTempF: null }}
      />,
    );
    // The secondary strip should not have a "Water Nan" or stray label
    expect(html).not.toMatch(/Water\s+(NaN|null|undefined)/);
  });

  it('omits UV when not ingested', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection
        date="2026-06-02"
        ageBucket="6-9"
        data={{ ...baseData, uv: null }}
      />,
    );
    expect(html).not.toMatch(/UV\s+NaN/);
  });

  it('reflects caution water-quality status in the secondary strip', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection
        date="2026-06-02"
        ageBucket="6-9"
        data={{ ...baseData, waterQualityStatus: 'caution' }}
      />,
    );
    expect(html).toContain('Quality caution');
    expect(html).toContain('text-status-caution-fg');
  });

  it('initial-render shows the microcopy skeleton (LazyContent idle/loading state)', () => {
    // LazyContent renders its skeleton on initial SSR — the AI fetch
    // happens on mount, which never runs in renderToStaticMarkup.
    const html = renderToStaticMarkup(
      <RichmondConditionsSection date="2026-06-02" ageBucket="6-9" data={baseData} />,
    );
    expect(html).toContain('animate-pulse');
  });

  it('happiness gauge has accessible meter role', () => {
    const html = renderToStaticMarkup(
      <RichmondConditionsSection date="2026-06-02" ageBucket="6-9" data={baseData} />,
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="85"');
    expect(html).toContain('Excellent day for the river');
  });
});

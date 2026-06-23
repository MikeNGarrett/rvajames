import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisoriesBanner } from './AdvisoriesBanner';

type Advisory = {
  id: string;
  kind: string;
  severity: string;
  headline: string;
  body: string;
};

function makeAdvisory(overrides: Partial<Advisory> & { id: string }): Advisory {
  return {
    kind: 'water_quality',
    severity: 'high',
    headline: 'Bacterial water-quality advisory',
    body: '',
    ...overrides,
  };
}

function render(advisories: Advisory[]): string {
  return renderToStaticMarkup(React.createElement(AdvisoriesBanner, { advisories }));
}

describe('AdvisoriesBanner', () => {
  it('returns empty string when advisory list is empty', () => {
    expect(render([])).toBe('');
  });

  // ── Dedup: kinds with a dedicated top-of-page banner are NOT shown here ─────
  // CSO → CsoBanner; flood + severe-grade general → SevereWeatherBanner (both
  // in AlertStack). Showing them here too would duplicate the same alert.

  it('does not render CSO advisories (covered by the dedicated CSO banner)', () => {
    expect(render([
      makeAdvisory({ id: 'c1', kind: 'cso_overflow', headline: 'CSO discharge at CSO 34' }),
      makeAdvisory({ id: 'c2', kind: 'cso_overflow', headline: 'CSO discharge at CSO 12' }),
    ])).toBe('');
  });

  it('does not render flood alerts (covered by the severe-weather banner)', () => {
    expect(render([makeAdvisory({ id: 'f1', kind: 'flood_warning', headline: 'Flood Warning' })])).toBe('');
    expect(render([makeAdvisory({ id: 'f2', kind: 'flood_watch', headline: 'Flood Watch' })])).toBe('');
  });

  it('does not render a high-severity general alert (severe thunderstorm — covered)', () => {
    expect(render([
      makeAdvisory({ id: 'g1', kind: 'general', severity: 'high', headline: 'Severe Thunderstorm Watch' }),
    ])).toBe('');
  });

  // ── Catch-all: advisory types WITHOUT a dedicated banner do render ──────────

  it('renders a water-quality advisory with its headline', () => {
    const html = render([makeAdvisory({ id: 'w1', headline: 'Bacterial levels elevated' })]);
    expect(html).toContain('Bacterial levels elevated');
    expect(html).toContain('Active Advisory');
  });

  it('renders a low-severity general advisory (no dedicated banner for it)', () => {
    const html = render([
      makeAdvisory({ id: 'g2', kind: 'general', severity: 'moderate', headline: 'Special Weather Statement' }),
    ]);
    expect(html).toContain('Special Weather Statement');
  });

  it('filters dedicated-banner kinds out of a mixed list, showing only the rest', () => {
    const html = render([
      makeAdvisory({ id: 'c1', kind: 'cso_overflow', headline: 'CSO discharge at CSO 34' }),
      makeAdvisory({ id: 'f1', kind: 'flood_warning', headline: 'Flood Warning in effect' }),
      makeAdvisory({ id: 'w1', headline: 'Bacterial levels elevated' }),
    ]);
    expect(html).toContain('Bacterial levels elevated');
    expect(html).not.toContain('CSO 34');
    expect(html).not.toContain('Flood Warning');
    expect(html).toContain('Active Advisory');
    expect(html).not.toContain('Active Advisories'); // exactly one shown → singular
  });

  it('pluralizes the header for multiple non-dedicated advisories', () => {
    const html = render([
      makeAdvisory({ id: 'w1', headline: 'Bacterial levels elevated' }),
      makeAdvisory({ id: 'w2', kind: 'swim_closure', headline: 'Swim area closed for testing' }),
    ]);
    expect(html).toContain('2 Active Advisories');
  });
});

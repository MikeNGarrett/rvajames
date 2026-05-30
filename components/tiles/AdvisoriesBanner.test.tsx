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
    kind: 'flood_warning',
    severity: 'high',
    headline: 'Flood warning in effect',
    body: '',
    ...overrides,
  };
}

function makeCsoAdvisory(id: string, outfallName: string): Advisory {
  return {
    id,
    kind: 'cso_overflow',
    severity: 'high',
    headline: `CSO discharge at ${outfallName}`,
    body: `Combined sewer overflow event recorded at ${outfallName}.`,
  };
}

function render(advisories: Advisory[]): string {
  return renderToStaticMarkup(
    React.createElement(AdvisoriesBanner, { advisories }),
  );
}

describe('AdvisoriesBanner', () => {
  it('returns empty string when advisory list is empty', () => {
    expect(render([])).toBe('');
  });

  // ── CSO aggregation ────────────────────────────────────────────────────────

  it('aggregates a single CSO advisory into one row without outfall name', () => {
    const html = render([makeCsoAdvisory('a1', 'CSO 34')]);
    expect(html).toContain('1 active sewer overflow in Richmond');
    // Must NOT expose the outfall ID in the rendered HTML
    expect(html).not.toContain('CSO 34');
  });

  it('aggregates multiple CSO advisories into a single row (count-based copy)', () => {
    const html = render([
      makeCsoAdvisory('a1', 'CSO 34'),
      makeCsoAdvisory('a2', 'CSO 12'),
      makeCsoAdvisory('a3', 'CSO 07'),
    ]);
    // Only ONE aggregated block — not three separate rows
    expect(html).toContain('3 active sewer overflows in Richmond');
    // Singular match must not appear when count is 3
    expect(html).not.toContain('1 active sewer overflow');
    // No individual outfall IDs must appear in the default render
    expect(html).not.toContain('CSO 34');
    expect(html).not.toContain('CSO 12');
    expect(html).not.toContain('CSO 07');
  });

  it('includes the 48h bacterial contamination message', () => {
    const html = render([makeCsoAdvisory('a1', 'CSO 34')]);
    expect(html).toContain('bacterial contamination elevated for at least 48h');
  });

  // ── Non-CSO advisories render individually ────────────────────────────────

  it('renders non-CSO advisories one-per-row with their headline', () => {
    const html = render([
      makeAdvisory({ id: 'f1', kind: 'flood_warning', headline: 'Flood advisory' }),
    ]);
    expect(html).toContain('Flood advisory');
  });

  // ── Mixed advisory sources ────────────────────────────────────────────────

  it('aggregates CSO advisories while rendering other types one-per-row', () => {
    const html = render([
      makeCsoAdvisory('c1', 'CSO 34'),
      makeCsoAdvisory('c2', 'CSO 12'),
      makeAdvisory({ id: 'f1', kind: 'flood_warning', headline: 'Flood warning in effect' }),
    ]);

    // CSO block aggregated to count
    expect(html).toContain('2 active sewer overflows in Richmond');
    expect(html).not.toContain('CSO 34');
    expect(html).not.toContain('CSO 12');

    // Flood advisory rendered normally
    expect(html).toContain('Flood warning in effect');

    // Row count header shows 2 (CSO block + flood)
    expect(html).toContain('2 Active Advisories');
  });

  it('row count header says "Active Advisory" (singular) for one CSO + zero other', () => {
    const html = render([makeCsoAdvisory('c1', 'CSO 34')]);
    expect(html).toContain('Active Advisory');
    expect(html).not.toContain('Active Advisories');
  });

  it('row count header says "2 Active Advisories" for one CSO + one other', () => {
    const html = render([
      makeCsoAdvisory('c1', 'CSO 34'),
      makeAdvisory({ id: 'f1', kind: 'flood_warning', headline: 'Flood warning' }),
    ]);
    expect(html).toContain('2 Active Advisories');
  });
});

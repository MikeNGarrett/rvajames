/**
 * SSR-only test for LocationInterpretationSummary's initial render.
 *
 * renderToStaticMarkup never runs effects, so the provider stays in its
 * 'idle' state — exactly what the server HTML and first paint show. The
 * summary must reserve its skeleton space there; rendering nothing let the
 * panels below (water quality, upstream CSO) paint in the AI card's slot and
 * then jump when the card arrived (Lighthouse CLS 0.083 on location pages).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocationInterpretationProvider } from './LocationInterpretationProvider';
import { LocationInterpretationSummary } from './LocationInterpretationSections';

describe('LocationInterpretationSummary', () => {
  it('renders the skeleton on the initial (pre-effect) render', () => {
    const html = renderToStaticMarkup(
      <LocationInterpretationProvider slug="pony-pasture" date="2026-10-24" ageBucket="6-9">
        <LocationInterpretationSummary mode="observed" dateLabel={null} forecastConfidence={null} />
      </LocationInterpretationProvider>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('min-h-[400px]');
    expect(html).toContain('aria-label="Loading interpretation"');
  });
});

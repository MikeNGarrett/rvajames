import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpstreamCsoPanel } from './UpstreamCsoPanel';
import type { UpstreamCsoSignal } from '@/lib/safety/upstream-cso';
import type { AgeBucket } from '@/lib/url-state';

function makeSignal(
  outfalls: Array<{ name: string; hoursAgo: number }>,
): UpstreamCsoSignal {
  const now = Date.now();
  return {
    count: outfalls.length,
    mostRecentAt: outfalls.length
      ? new Date(now - outfalls[0].hoursAgo * 3_600_000).toISOString()
      : null,
    outfalls: outfalls.map((o) => ({
      name: o.name,
      hoursAgo: o.hoursAgo,
      csoOccurredAt: new Date(now - o.hoursAgo * 3_600_000).toISOString(),
    })),
  };
}

interface RenderOpts {
  mode?: 'observed' | 'forecast';
  ageBucket?: AgeBucket;
  selectedDate?: string;
}

function render(signal: UpstreamCsoSignal, opts: RenderOpts = {}): string {
  return renderToStaticMarkup(
    React.createElement(UpstreamCsoPanel, {
      upstreamCso: signal,
      mode: opts.mode ?? 'observed',
      ageBucket: opts.ageBucket ?? 'none',
      selectedDate: opts.selectedDate ?? '2026-05-30',
    }),
  );
}

// ─── Core rendering ────────────────────────────────────────────────────────────

describe('UpstreamCsoPanel — core rendering', () => {
  it('returns null when count === 0', () => {
    const html = render(makeSignal([]));
    expect(html).toBe('');
  });

  it('renders the section heading', () => {
    const html = render(makeSignal([{ name: 'Outfall A', hoursAgo: 5 }]));
    expect(html).toContain('Upstream Sewer Overflow');
  });

  it('renders singular overflow count', () => {
    const html = render(makeSignal([{ name: 'Outfall A', hoursAgo: 5 }]));
    expect(html).toContain('1 sewer overflow upstream');
    expect(html).not.toContain('1 sewer overflows upstream');
  });

  it('renders plural overflow count for 2 events', () => {
    const html = render(
      makeSignal([
        { name: 'A', hoursAgo: 5 },
        { name: 'B', hoursAgo: 10 },
      ]),
    );
    expect(html).toContain('2 sewer overflows upstream');
  });

  it('renders plural overflow count for N events', () => {
    const html = render(
      makeSignal([
        { name: 'A', hoursAgo: 2 },
        { name: 'B', hoursAgo: 6 },
        { name: 'C', hoursAgo: 12 },
        { name: 'D', hoursAgo: 24 },
      ]),
    );
    expect(html).toContain('4 sewer overflows upstream');
  });

  it('does NOT render a list of individual outfall names', () => {
    const html = render(
      makeSignal([
        { name: 'Shockoe Bottom', hoursAgo: 10 },
        { name: 'CSO 34', hoursAgo: 5 },
      ]),
    );
    // No <li> elements for individual outfalls
    expect(html).not.toContain('<li');
    // Individual outfall names must not appear
    expect(html).not.toContain('Shockoe Bottom');
    expect(html).not.toContain('CSO 34');
  });

  it('renders the EmNet attribution link', () => {
    const html = render(makeSignal([{ name: 'Any', hoursAgo: 6 }]));
    expect(html).toContain('emnet.net');
    expect(html).toContain('Richmond DPU via EmNet');
  });
});

// ─── Observed mode — age-bucket tone ─────────────────────────────────────────

describe('UpstreamCsoPanel — observed mode age-bucket tone', () => {
  const signal = makeSignal([{ name: 'Outfall A', hoursAgo: 5 }]);

  it('0-2: uses "Avoid all water contact with your kids" urgency', () => {
    const html = render(signal, { ageBucket: '0-2' });
    expect(html).toContain('Avoid all water contact with your kids');
    expect(html).toContain('in the past 48 hours');
  });

  it('3-5: uses "Avoid all water contact with your kids" urgency', () => {
    const html = render(signal, { ageBucket: '3-5' });
    expect(html).toContain('Avoid all water contact with your kids');
  });

  it('6-9: uses "Avoid swimming and wading" standard language', () => {
    const html = render(signal, { ageBucket: '6-9' });
    expect(html).toContain('Avoid swimming and wading');
    expect(html).not.toContain('your kids');
    expect(html).not.toContain('consider postponing');
  });

  it('10-13: uses "Avoid swimming and wading" standard language', () => {
    const html = render(signal, { ageBucket: '10-13' });
    expect(html).toContain('Avoid swimming and wading');
  });

  it('14+: uses softer "consider postponing water contact"', () => {
    const html = render(signal, { ageBucket: '14+' });
    expect(html).toContain('consider postponing water contact');
    expect(html).not.toContain('Avoid swimming');
    expect(html).not.toContain('your kids');
  });

  it('none (adult default): uses softer "consider postponing water contact"', () => {
    const html = render(signal, { ageBucket: 'none' });
    expect(html).toContain('consider postponing water contact');
  });

  it('observed mode copy contains "in the past 48 hours"', () => {
    const html = render(signal, { mode: 'observed', ageBucket: '6-9' });
    expect(html).toContain('in the past 48 hours');
    expect(html).not.toContain('will still be in effect');
  });

  it('includes downstream bacterial caution in the amber block', () => {
    const html = render(signal, { ageBucket: 'none' });
    expect(html).toContain('Bacterial contamination may be elevated downstream');
    expect(html).toContain('consider postponing water contact');
  });
});

// ─── Forecast mode ────────────────────────────────────────────────────────────

describe('UpstreamCsoPanel — forecast mode', () => {
  const signal = makeSignal([{ name: 'Outfall A', hoursAgo: 5 }]);

  it('uses advisory-window language for forecast mode', () => {
    const html = render(signal, { mode: 'forecast', selectedDate: '2026-05-31' });
    expect(html).toContain('will still be in effect');
    expect(html).not.toContain('in the past 48 hours');
  });

  it('renders singular "advisory" for count === 1', () => {
    const html = render(signal, { mode: 'forecast' });
    expect(html).toContain('1 sewer overflow advisory');
    expect(html).not.toContain('1 sewer overflow advisories');
  });

  it('renders plural "advisories" for count > 1', () => {
    const html = render(
      makeSignal([
        { name: 'A', hoursAgo: 5 },
        { name: 'B', hoursAgo: 10 },
      ]),
      { mode: 'forecast' },
    );
    expect(html).toContain('2 sewer overflow advisories');
  });

  it('forecast + young age bucket includes strong action language', () => {
    const html = render(signal, { mode: 'forecast', ageBucket: '0-2' });
    expect(html).toContain('Avoid all water contact with your kids');
    expect(html).toContain('will still be in effect');
  });

  it('forecast + 14+ uses softer "consider postponing"', () => {
    const html = render(signal, { mode: 'forecast', ageBucket: '14+' });
    expect(html).toContain('consider postponing water contact');
    expect(html).toContain('will still be in effect');
  });

  it('NEVER includes outfall IDs in forecast mode', () => {
    const html = render(
      makeSignal([{ name: 'CSO 34', hoursAgo: 10 }]),
      { mode: 'forecast' },
    );
    expect(html).not.toMatch(/CSO\s*\d+/i);
    expect(html).not.toContain('CSO 34');
  });
});

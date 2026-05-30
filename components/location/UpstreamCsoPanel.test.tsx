import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpstreamCsoPanel } from './UpstreamCsoPanel';
import type { UpstreamCsoSignal } from '@/lib/safety/upstream-cso';

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

function render(signal: UpstreamCsoSignal): string {
  return renderToStaticMarkup(
    React.createElement(UpstreamCsoPanel, { upstreamCso: signal }),
  );
}

describe('UpstreamCsoPanel', () => {
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

  it('includes downstream bacterial caution in the amber block', () => {
    const html = render(makeSignal([{ name: 'Outfall A', hoursAgo: 5 }]));
    expect(html).toContain('Bacterial contamination may be elevated downstream');
    expect(html).toContain('consider postponing water contact');
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

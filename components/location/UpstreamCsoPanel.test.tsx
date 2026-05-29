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

  it('renders the outfall name', () => {
    const html = render(makeSignal([{ name: 'Shockoe Bottom', hoursAgo: 10 }]));
    expect(html).toContain('Shockoe Bottom');
  });

  it('renders hoursAgo for a single outfall', () => {
    const html = render(makeSignal([{ name: 'Outfall X', hoursAgo: 8 }]));
    expect(html).toContain('8 hours ago');
  });

  it('renders singular "hour" for hoursAgo === 1', () => {
    const html = render(makeSignal([{ name: 'Outfall Y', hoursAgo: 1 }]));
    expect(html).toContain('1 hour ago');
    expect(html).not.toContain('1 hours ago');
  });

  it('renders "less than 1 hour ago" for hoursAgo === 0', () => {
    const html = render(makeSignal([{ name: 'Fresh', hoursAgo: 0 }]));
    expect(html).toContain('less than 1 hour ago');
  });

  it('renders multiple outfalls', () => {
    const html = render(
      makeSignal([
        { name: 'Outfall Alpha', hoursAgo: 4 },
        { name: 'Outfall Beta', hoursAgo: 22 },
      ]),
    );
    expect(html).toContain('Outfall Alpha');
    expect(html).toContain('Outfall Beta');
  });

  it('renders the EmNet attribution link', () => {
    const html = render(makeSignal([{ name: 'Any', hoursAgo: 6 }]));
    expect(html).toContain('emnet.net');
    expect(html).toContain('Richmond DPU via EmNet');
  });

  it('renders singular event count in the amber caution block', () => {
    const html = render(makeSignal([{ name: 'One', hoursAgo: 3 }]));
    expect(html).toContain('1 upstream sewer overflow event in the past 48 hours');
  });

  it('renders plural event count for multiple events', () => {
    const html = render(
      makeSignal([
        { name: 'A', hoursAgo: 5 },
        { name: 'B', hoursAgo: 10 },
      ]),
    );
    expect(html).toContain('2 upstream sewer overflow events in the past 48 hours');
  });
});

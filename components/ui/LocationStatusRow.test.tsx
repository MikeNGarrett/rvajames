import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocationStatusRow } from './LocationStatusRow';

const wqSafe    = { status: 'safe' as const,    ecoliCfuPer100ml: 50 };
const wqCaution = { status: 'caution' as const, ecoliCfuPer100ml: 400 };
const csoActive = { count: 2, advisoryIds: ['a', 'b'] } as unknown as Parameters<typeof LocationStatusRow>[0]['upstreamCso'];
const oneCso    = { count: 1, advisoryIds: ['a'] }      as unknown as Parameters<typeof LocationStatusRow>[0]['upstreamCso'];

describe('LocationStatusRow', () => {
  it('returns null when there is no water-quality reading AND no CSO data AND affirmative-CSO is hidden', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={null} upstreamCso={null} hideAffirmativeCso />,
    );
    expect(html).toBe('');
  });

  it('renders the affirmative "No overflows upstream" item by default even when waterQuality is null', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={null} upstreamCso={null} />,
    );
    expect(html).toContain('No overflows upstream');
    expect(html).not.toContain('Water OK');
    expect(html).not.toContain('Water caution');
  });

  it('renders both water-OK and "No overflows" when waterQuality safe + no CSO', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={wqSafe} upstreamCso={null} />,
    );
    expect(html).toContain('Water OK');
    expect(html).toContain('No overflows upstream');
    expect(html).not.toContain('Water caution');
  });

  it('renders water-caution + CSO count when both states are active', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={wqCaution} upstreamCso={csoActive} />,
    );
    expect(html).toContain('Water caution');
    expect(html).toContain('2 overflows upstream');
    expect(html).not.toContain('No overflows upstream');
  });

  it('pluralizes "overflow" correctly for count = 1', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={null} upstreamCso={oneCso} />,
    );
    expect(html).toContain('1 overflow upstream');
    expect(html).not.toContain('1 overflows upstream');
  });

  it('uses a <ul role="list"> so AT announces it as a list', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={wqSafe} upstreamCso={null} />,
    );
    expect(html).toMatch(/<ul[^>]+role="list"/);
    expect(html).toMatch(/<li/);
  });

  it('hides the affirmative CSO item when hideAffirmativeCso is true and renders only water-quality', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={wqSafe} upstreamCso={null} hideAffirmativeCso />,
    );
    expect(html).toContain('Water OK');
    expect(html).not.toContain('No overflows upstream');
  });

  it('still shows the active CSO warning when hideAffirmativeCso is true', () => {
    const html = renderToStaticMarkup(
      <LocationStatusRow waterQuality={null} upstreamCso={csoActive} hideAffirmativeCso />,
    );
    expect(html).toContain('2 overflows upstream');
  });
});

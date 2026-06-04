import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CsoBadge } from './CsoBadge';

describe('CsoBadge', () => {
  it('renders the aria-label and title for screen readers and tooltips', () => {
    const html = renderToStaticMarkup(<CsoBadge />);
    expect(html).toContain('aria-label="CSO event upstream in past 48 hours"');
    expect(html).toContain('title="Upstream sewer overflow');
  });

  it('renders the circle + "!" SVG silhouette so the badge is shape-distinct from WaterQualityIcon\'s drop', () => {
    const html = renderToStaticMarkup(<CsoBadge />);
    expect(html).toContain('<circle');
    expect(html).toContain('>!<');
  });

  it('marks the SVG as aria-hidden so the wrapper text alternative wins', () => {
    const html = renderToStaticMarkup(<CsoBadge />);
    expect(html).toMatch(/<svg[^>]+aria-hidden/i);
  });

  it('defaults to 12 px square', () => {
    const html = renderToStaticMarkup(<CsoBadge />);
    expect(html).toContain('width="12"');
    expect(html).toContain('height="12"');
  });

  it('honors a custom size', () => {
    const html = renderToStaticMarkup(<CsoBadge size={20} />);
    expect(html).toContain('width="20"');
    expect(html).toContain('height="20"');
  });
});

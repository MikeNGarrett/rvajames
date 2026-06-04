import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DisclaimerFooter } from './DisclaimerFooter';

describe('DisclaimerFooter', () => {
  it('links to /about', () => {
    const html = renderToStaticMarkup(<DisclaimerFooter />);
    expect(html).toContain('href="/about"');
    expect(html).toContain('About RVA James');
  });

  it('still renders the safety-resources link', () => {
    const html = renderToStaticMarkup(<DisclaimerFooter />);
    expect(html).toContain('href="/safety"');
  });

  it('uses age-specific microcopy when ageBucket is provided (AAP guidance)', () => {
    const html = renderToStaticMarkup(<DisclaimerFooter ageBucket="6-9" />);
    expect(html).toContain('AAP');
  });

  it('drops the AAP-specific microcopy when ageBucket is "none"', () => {
    const html = renderToStaticMarkup(<DisclaimerFooter ageBucket="none" />);
    expect(html).not.toContain('AAP');
  });
});

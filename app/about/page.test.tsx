import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AboutPage from './page';

describe('/about page', () => {
  const html = renderToStaticMarkup(<AboutPage />);

  it('renders the Back-to-dashboard link', () => {
    expect(html).toContain('href="/"');
    expect(html).toContain('Back to dashboard');
  });

  it('renders the page heading', () => {
    expect(html).toContain('About RVA James');
  });

  describe('creator bio — VERBATIM, do not paraphrase', () => {
    // These exact strings come from the user 2026-06-04. Any edit that
    // changes them silently will fail these tests on purpose.
    it('opens with the "passion project by Mike Garrett" line', () => {
      expect(html).toContain('RVA James is a passion project by Mike Garrett.');
    });

    it('includes the "moved to Richmond in 2016" line', () => {
      expect(html).toContain('moved to Richmond in 2016');
      expect(html).toContain('one of the city');
    });

    it('includes the "constantly searching for practical information" framing', () => {
      expect(html).toContain('constantly searching for practical information');
    });

    it('includes the explicit non-credentials disclosure', () => {
      // Verbatim: "I'm not a riverkeeper, biologist, historian, or
      // professional guide." Apostrophe is escaped to &rsquo; in the
      // rendered HTML.
      expect(html).toContain('not a riverkeeper, biologist, historian, or professional guide');
    });

    it('closes with the "record of that journey" line', () => {
      expect(html).toContain('record of that journey');
    });
  });

  describe('how it\'s built section', () => {
    it('renders the plain-language stack overview', () => {
      expect(html).toContain('Next.js');
      expect(html).toContain('Cloudflare Workers');
      expect(html).toContain('Supabase');
      expect(html).toContain('Anthropic');
    });

    it('links to the public repo with target=_blank and rel=noopener noreferrer', () => {
      expect(html).toContain('https://github.com/MikeNGarrett/rvajames');
      expect(html).toMatch(
        /href="https:\/\/github\.com\/MikeNGarrett\/rvajames"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
      );
    });

    it('uses a collapsible <details>/<summary> for the technically-curious sidebar', () => {
      expect(html).toMatch(/<details[^>]*>/);
      expect(html).toMatch(/<summary[^>]*>For the technically curious<\/summary>/);
    });

    it('mentions the prompt-caching + dedup-hash design in the sidebar', () => {
      expect(html).toContain('prompt caching');
      expect(html).toMatch(/SHA-?256|hash/i);
    });

    it('cross-links to /safety and /status from the sidebar', () => {
      expect(html).toContain('href="/safety"');
      expect(html).toContain('href="/status"');
    });
  });

  describe('AI-disclosure posture', () => {
    it('explicitly states the AI does NOT make safety decisions', () => {
      expect(html).toMatch(/never to make safety decisions|never decides who can swim|never fetches data/i);
    });
  });
});

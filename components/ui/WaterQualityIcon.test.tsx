/**
 * WaterQualityIcon — shape/accessibility tests.
 *
 * Renders to static HTML via React's renderToStaticMarkup so we can assert
 * on the actual DOM shape, attributes, and SVG content without a full
 * client-side test runner. Matches the pattern used by
 * RichmondConditionsSection.test.tsx and the rest of the project.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WaterQualityIcon } from './WaterQualityIcon';

describe('WaterQualityIcon', () => {
  describe('safe state', () => {
    it('renders an aria-labeled span with the safe descriptor', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="safe" />);
      expect(html).toContain('aria-label="Water quality: safe"');
      expect(html).toContain('title="Water quality: safe"');
    });

    it('uses the rva-blue color class', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="safe" />);
      expect(html).toContain('text-rva-blue');
      expect(html).not.toContain('text-status-caution-fg');
    });

    it('renders the drop path WITHOUT the caution "!" glyph', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="safe" />);
      expect(html).toContain('<path');
      // The "!" text element should only appear in the caution variant.
      expect(html).not.toContain('<text');
    });
  });

  describe('caution state', () => {
    it('renders an aria-labeled span with the elevated-bacteria descriptor', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="caution" />);
      expect(html).toContain('aria-label="Water quality: elevated bacteria"');
      expect(html).toContain('title="Water quality: elevated bacteria"');
    });

    it('uses the caution color class', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="caution" />);
      expect(html).toContain('text-status-caution-fg');
      expect(html).not.toContain('text-rva-blue');
    });

    it('renders both the drop path AND the "!" overlay so the two states differ by shape, not just color', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="caution" />);
      expect(html).toContain('<path');
      // The "!" overlay is what makes the caution state shape-distinct from safe
      expect(html).toContain('<text');
      expect(html).toContain('>!<');
      // Verify the "!" is rendered at a size that's actually readable
      // (the prior 5pt glyph was illegible at small sizes)
      expect(html).toMatch(/font-size="14"|fontsize="14"/i);
    });
  });

  describe('size prop', () => {
    it('defaults to 16 px square', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="safe" />);
      expect(html).toContain('width="16"');
      expect(html).toContain('height="16"');
    });

    it('honors a custom size', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="caution" size={32} />);
      expect(html).toContain('width="32"');
      expect(html).toContain('height="32"');
    });
  });

  describe('showLabel prop', () => {
    it('hides the visible text label by default', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="safe" />);
      expect(html).not.toContain('Water OK');
      expect(html).not.toContain('Water caution');
    });

    it('renders the safe short label inline when showLabel is true', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="safe" showLabel />);
      expect(html).toContain('Water OK');
      // When showLabel is true, the visible text becomes the accessible name,
      // so aria-label is omitted to avoid duplicate announcements.
      expect(html).not.toContain('aria-label="Water quality: safe"');
      // Title is preserved as a tooltip hint.
      expect(html).toContain('title="Water quality: safe"');
    });

    it('renders the caution short label inline when showLabel is true', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="caution" showLabel />);
      expect(html).toContain('Water caution');
      expect(html).not.toContain('aria-label="Water quality: elevated bacteria"');
      expect(html).toContain('title="Water quality: elevated bacteria"');
    });
  });

  describe('accessibility', () => {
    it('marks the decorative SVG as aria-hidden so the wrapper text alternative wins', () => {
      const html = renderToStaticMarkup(<WaterQualityIcon status="caution" />);
      // The SVG itself is decorative; the wrapper span carries the accessible name.
      expect(html).toMatch(/<svg[^>]+aria-hidden/i);
    });
  });
});

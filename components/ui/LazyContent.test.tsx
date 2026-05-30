/**
 * SSR-only tests for the LazyContent wrapper and its primitives.
 *
 * The project's test style is renderToStaticMarkup (no jsdom), so we cover:
 *   - The initial render path (state='idle', before useEffect runs)
 *   - aria attributes baked into JSX
 *   - motion-reduce classes present on animated children
 *   - Spinner + SkeletonShimmer markup contracts
 *
 * The interactive transitions (loading→success, error→retry, stale-while-
 * revalidate opacity swap) are validated manually during sub-goal 65's
 * stop-and-demo checkpoint with DevTools throttling. The state-machine bits
 * we CAN test cleanly are covered by lazy-fetch.test.ts.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LazyContent } from './LazyContent';
import { Spinner } from './Spinner';
import { SkeletonShimmer } from './SkeletonShimmer';

// ─── Spinner ──────────────────────────────────────────────────────────────

describe('Spinner', () => {
  it('renders with default size and aria-label', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).toContain('aria-label="Loading"');
    expect(html).toContain('role="status"');
    expect(html).toContain('width="16"');
    expect(html).toContain('height="16"');
  });

  it('accepts a custom size and label', () => {
    const html = renderToStaticMarkup(<Spinner size={24} label="Loading recommendations" />);
    expect(html).toContain('aria-label="Loading recommendations"');
    expect(html).toContain('width="24"');
  });

  it('includes motion-reduce class so reduced-motion users see no animation', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).toContain('motion-reduce:animate-none');
    expect(html).toContain('animate-spin');
  });

  it('forwards extra className to the wrapper', () => {
    const html = renderToStaticMarkup(<Spinner className="text-rva-blue" />);
    expect(html).toContain('text-rva-blue');
  });
});

// ─── SkeletonShimmer ──────────────────────────────────────────────────────

describe('SkeletonShimmer', () => {
  it('wraps children and renders the shimmer overlay with motion-reduce', () => {
    const html = renderToStaticMarkup(
      <SkeletonShimmer>
        <div data-testid="inner">silhouette</div>
      </SkeletonShimmer>,
    );
    // Child still rendered inside
    expect(html).toContain('silhouette');
    // Wrapper has positioning to anchor the absolute overlay
    expect(html).toContain('relative');
    expect(html).toContain('overflow-hidden');
    // Overlay uses the shimmer keyframes + motion-reduce escape
    expect(html).toContain('animate-[shimmer_2s_infinite_linear]');
    expect(html).toContain('motion-reduce:animate-none');
    // Overlay is aria-hidden — purely decorative
    expect(html).toContain('aria-hidden');
  });
});

// ─── LazyContent — initial render (idle / pre-effect) ─────────────────────

describe('LazyContent — SSR initial render', () => {
  function renderLazy(
    props?: Partial<React.ComponentProps<typeof LazyContent<{ headline: string }>>>,
  ): string {
    return renderToStaticMarkup(
      <LazyContent<{ headline: string }>
        url="https://x/api/foo"
        parse={(raw) => raw as { headline: string }}
        skeleton={<div data-testid="sk">skeleton silhouette</div>}
        {...props}
      >
        {(data) => <p>{data.headline}</p>}
      </LazyContent>,
    );
  }

  it('renders the skeleton on first render (state is idle, no prior data)', () => {
    const html = renderLazy();
    expect(html).toContain('skeleton silhouette');
  });

  it('wraps the skeleton in the shimmer overlay', () => {
    const html = renderLazy();
    expect(html).toContain('animate-[shimmer_2s_infinite_linear]');
  });

  it('sets aria-busy=true on the wrapper during initial load', () => {
    const html = renderLazy();
    expect(html).toContain('aria-busy="true"');
  });

  it('sets aria-live=polite on the wrapper so AT announces content arrival', () => {
    const html = renderLazy();
    expect(html).toContain('aria-live="polite"');
  });

  it('renders the spinner alongside the skeleton', () => {
    const html = renderLazy();
    expect(html).toContain('role="status"');
    expect(html).toContain('animate-spin');
  });

  it('does NOT render the statusText immediately (only after 500ms delay)', () => {
    const html = renderLazy({ statusText: 'Generating recommendations…' });
    // On initial render the showStatusText state is false; the text is gated.
    expect(html).not.toContain('Generating recommendations…');
  });

  it('uses a custom spinnerLabel when provided', () => {
    const html = renderLazy({ spinnerLabel: 'Loading recommendations' });
    expect(html).toContain('aria-label="Loading recommendations"');
  });
});

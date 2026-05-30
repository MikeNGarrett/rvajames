'use client';

/**
 * LazyContent — client wrapper that fetches a URL on mount + on URL change,
 * parses the response, and renders one of four states (sub-goal 64).
 *
 * State machine:
 *   - idle               → just mounted, fetch about to start
 *   - loading            → fetch in flight, no prior data
 *   - loading-stale      → fetch in flight, prior success data still visible
 *                          at reduced opacity (stale-while-revalidate UX)
 *   - success            → fetched + parsed cleanly; render via `children`
 *   - error              → fetch or parse failed; render error banner +
 *                          "Retry →" button that re-fires the effect
 *
 * The wrapper is generic over T (the parsed response shape). Callers pass a
 * `parse` function that turns the raw JSON into T or throws — typically a
 * zod schema's `.parse(...)`.
 *
 * URL change triggers abort + refetch. AbortController is also fired on
 * unmount so we don't setState into a dead component. AbortError is
 * swallowed silently (not treated as a real error).
 *
 * Accessibility:
 *   - aria-live="polite" on the wrapper so AT users hear new content arrive.
 *   - aria-busy reflects loading state.
 *   - The Spinner's role="status" + aria-label gives a separate "Loading…"
 *     announcement for context that doesn't include the new content.
 *
 * Status text:
 *   - Optional one-line message ("Generating recommendations…") that
 *     appears only after 500ms of loading. A warm-cache 50ms response
 *     never shows the text, so we don't flash it.
 *
 * Reduced motion is honoured at the primitive level (Spinner +
 * SkeletonShimmer both use motion-reduce:animate-none).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from './Spinner';
import { SkeletonShimmer } from './SkeletonShimmer';
import { lazyFetch } from './lazy-fetch';

interface Props<T> {
  /**
   * Fetch URL. The component re-fetches whenever this string value changes
   * — e.g. when the user picks a new date or age in the filter form. Keep
   * it stable across renders by deriving it from URL params, not from
   * fresh objects each render.
   */
  url: string;
  /**
   * Parse / validate the raw JSON response. Should throw on invalid data;
   * the wrapper catches throws and renders the error state. Typical use:
   * `parse: (raw) => MySchema.parse(raw)`.
   */
  parse: (raw: unknown) => T;
  /** Skeleton element rendered during initial load with no prior data. */
  skeleton: React.ReactNode;
  /** Render function for the successful response. */
  children: (data: T) => React.ReactNode;
  /**
   * Optional text shown alongside the spinner after 500ms of loading.
   * Appears below the skeleton during initial load, or alongside prior
   * data during a stale-while-revalidate fetch.
   */
  statusText?: string;
  /**
   * Optional label for the inline spinner. Defaults to "Loading". Pass
   * something more specific where context helps AT users
   * (e.g. "Loading recommendations").
   */
  spinnerLabel?: string;
}

type State<T> =
  | { kind: 'idle' }
  | { kind: 'loading'; prior: T | null }
  | { kind: 'success'; data: T }
  | { kind: 'error'; message: string; prior: T | null };

const STATUS_TEXT_DELAY_MS = 500;

export function LazyContent<T>({
  url,
  parse,
  skeleton,
  children,
  statusText,
  spinnerLabel = 'Loading',
}: Props<T>) {
  const [state, setState] = useState<State<T>>({ kind: 'idle' });
  const [retryCount, setRetryCount] = useState(0);
  // 500ms-delayed flag for showing statusText. Re-armed on every fetch.
  const [showStatusText, setShowStatusText] = useState(false);

  // Last successful payload, kept across URL changes so we can show prior
  // data at reduced opacity while the new fetch runs (stale-while-revalidate
  // UX from the plan).
  const lastSuccessRef = useRef<T | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setShowStatusText(false);
    const statusTimer = setTimeout(
      () => setShowStatusText(true),
      STATUS_TEXT_DELAY_MS,
    );

    setState({ kind: 'loading', prior: lastSuccessRef.current });

    (async () => {
      try {
        const data = await lazyFetch(url, parse, ac.signal);
        lastSuccessRef.current = data;
        setState({ kind: 'success', data });
      } catch (err: unknown) {
        // AbortError fires on unmount + on URL change. Swallow — not a real
        // failure, just a request that's no longer relevant.
        if (err instanceof Error && err.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'Couldn’t load';
        setState({
          kind:    'error',
          message,
          prior:   lastSuccessRef.current,
        });
      }
    })();

    return () => {
      clearTimeout(statusTimer);
      ac.abort();
    };
    // retryCount is intentionally in deps — incrementing it re-fires the fetch.
  }, [url, retryCount, parse]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  // ── Render ─────────────────────────────────────────────────────────────
  if (state.kind === 'success') {
    return (
      <div aria-live="polite" aria-busy={false}>
        {children(state.data)}
      </div>
    );
  }

  if (state.kind === 'error') {
    // Keep prior data visible above the error banner if we have any —
    // helps the user not feel like everything broke just because the
    // refresh failed.
    return (
      <div aria-live="polite" aria-busy={false}>
        {state.prior && (
          <div className="opacity-60">{children(state.prior)}</div>
        )}
        <div
          role="alert"
          className="rounded-xl border border-status-danger/40 bg-status-danger-subtle p-4 my-2"
        >
          <p className="text-sm font-medium text-text mb-2">
            Couldn&rsquo;t load. {state.message}
          </p>
          <button
            type="button"
            onClick={retry}
            className="touch-target inline-flex items-center gap-1 rounded-lg bg-rva-blue px-3 text-sm font-semibold text-white hover:bg-rva-blue/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rva-blue focus-visible:ring-offset-1"
          >
            Retry <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

  // loading or idle ─────────────────────────────────────────────────────
  const prior = state.kind === 'loading' ? state.prior : null;

  if (prior) {
    // stale-while-revalidate: prior data at reduced opacity + inline spinner
    return (
      <div aria-live="polite" aria-busy={true} className="relative">
        <div className="opacity-60 transition-opacity">
          {children(prior)}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-surface-raised/90 px-2 py-1 shadow-sm text-text-secondary">
          <Spinner size={14} label={spinnerLabel} />
          {showStatusText && statusText && (
            <span className="text-xs">{statusText}</span>
          )}
        </div>
      </div>
    );
  }

  // Initial load: skeleton + spinner + optional delayed status text
  return (
    <div aria-live="polite" aria-busy={true}>
      <SkeletonShimmer>{skeleton}</SkeletonShimmer>
      <div className="flex items-center gap-2 text-text-secondary mt-1 px-1">
        <Spinner size={14} label={spinnerLabel} />
        {showStatusText && statusText && (
          <span className="text-xs">{statusText}</span>
        )}
      </div>
    </div>
  );
}

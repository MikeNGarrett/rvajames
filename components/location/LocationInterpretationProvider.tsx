'use client';

/**
 * LocationInterpretationProvider — shared client-side fetch for the AI
 * interpretation that drives FOUR sections on the location detail page
 * (sub-goal 66).
 *
 * Why this exists vs. dropping <LazyContent> around each section:
 *   The interpretation drives the AI narrative (headline + body), the
 *   activity matrix, the trip prep checklist, AND the attribution line.
 *   The page interleaves those four sections with deterministic ones
 *   (water quality, upstream CSO panels). Wrapping each AI section in
 *   its own LazyContent would fire four parallel fetches on mount —
 *   browser HTTP cache doesn't dedupe in-flight requests. This provider
 *   does ONE fetch, exposes the parsed interpretation via context, and
 *   lets each consumer subscribe.
 *
 * State machine matches LazyContent's:
 *   - idle               → before useEffect runs
 *   - loading            → fetch in flight, prior data may or may not exist
 *   - success            → data parsed; render
 *   - error              → fetch or parse failed; show error + retry
 *
 * The primary loading surface is the interpretation summary (the visually
 * prominent section). The other three consumers simply render null while
 * loading — they fill in once data arrives. This keeps the loading UX
 * focused without four staggered skeletons on the same page.
 *
 * Filter change (date/age) re-fires the effect via the URL dep. Prior data
 * stays visible at reduced opacity during the refetch (the consumers can
 * choose to opt into the stale-while-revalidate UX; the summary does).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { lazyFetch } from '@/components/ui/lazy-fetch';
import {
  InterpretationSchema,
  type Interpretation,
} from '@/lib/ai/prompts/interpret-location';
import type { AgeBucket } from '@/lib/url-state';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface Value {
  status:           Status;
  data:             Interpretation | null;
  /** Set during refetch (filter change) while we still have prior data. */
  prior:            Interpretation | null;
  message:          string | null;
  retry:            () => void;
  /** True after STATUS_TEXT_DELAY_MS of loading — gates the status caption. */
  showStatusText:   boolean;
}

const Ctx = createContext<Value | null>(null);

const STATUS_TEXT_DELAY_MS = 500;

function parseInterpretationResponse(raw: unknown): Interpretation {
  const r = raw as { interpretation?: unknown };
  if (!r?.interpretation) {
    throw new Error('Missing interpretation in API response');
  }
  return InterpretationSchema.parse(r.interpretation);
}

interface Props {
  slug:      string;
  date:      string;
  ageBucket: AgeBucket;
  children:  ReactNode;
}

export function LocationInterpretationProvider({
  slug,
  date,
  ageBucket,
  children,
}: Props) {
  const [status, setStatus]                 = useState<Status>('idle');
  const [data, setData]                     = useState<Interpretation | null>(null);
  const [message, setMessage]               = useState<string | null>(null);
  const [retryCount, setRetryCount]         = useState(0);
  const [showStatusText, setShowStatusText] = useState(false);

  // Last successful payload — survives across URL changes so consumers can
  // show prior data at reduced opacity during a refetch.
  const lastSuccessRef = useRef<Interpretation | null>(null);

  const url = useMemo(
    () => `/api/location-interpretation?slug=${slug}&date=${date}&age=${encodeURIComponent(ageBucket)}`,
    [slug, date, ageBucket],
  );

  useEffect(() => {
    const ac          = new AbortController();
    setStatus('loading');
    setMessage(null);
    setShowStatusText(false);
    const statusTimer = setTimeout(
      () => setShowStatusText(true),
      STATUS_TEXT_DELAY_MS,
    );

    (async () => {
      try {
        const interp = await lazyFetch(
          url,
          parseInterpretationResponse,
          ac.signal,
        );
        lastSuccessRef.current = interp;
        setData(interp);
        setStatus('success');
      } catch (err) {
        // AbortError fires on unmount or URL change. Swallow.
        if (err instanceof Error && err.name === 'AbortError') return;
        setMessage(err instanceof Error ? err.message : 'Couldn’t load');
        setStatus('error');
      }
    })();

    return () => {
      clearTimeout(statusTimer);
      ac.abort();
    };
  }, [url, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  const value = useMemo<Value>(
    () => ({
      status,
      data,
      prior:          lastSuccessRef.current,
      message,
      retry,
      showStatusText,
    }),
    [status, data, message, retry, showStatusText],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Subscribe to the location interpretation state from anywhere inside the
 * provider's subtree. Throws if called outside the provider — a misuse
 * we want to catch loudly at dev time.
 */
export function useLocationInterpretation(): Value {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      'useLocationInterpretation must be called inside <LocationInterpretationProvider>',
    );
  }
  return v;
}

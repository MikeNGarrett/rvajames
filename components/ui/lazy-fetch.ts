/**
 * Pure async fetch helper extracted from <LazyContent> (sub-goal 64).
 *
 * Why split this out of the component:
 *   - Lets us unit-test the network + parse + error-handling contract
 *     without spinning up jsdom or React Testing Library — the project's
 *     test style stays consistent (pure-function tests via vitest, server
 *     renders via renderToStaticMarkup).
 *   - Makes the contract explicit: a function that takes (url, parse,
 *     signal) and returns a parsed T or throws.
 *
 * Error shape: throws Error with a message string. The wrapper component
 * surfaces that message in the error banner. AbortError is preserved as-is
 * so the caller can swallow it.
 */
export async function lazyFetch<T>(
  url: string,
  parse: (raw: unknown) => T,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    // Try to extract a structured { error: string } body. If the server
    // returned non-JSON, fall back to a generic status-code message.
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body?.error === 'string' && body.error.length > 0) {
        message = body.error;
      }
    } catch {
      // body wasn't JSON; keep the status-code message.
    }
    throw new Error(message);
  }

  const raw = await res.json();
  // Parse can throw on schema mismatch — that propagates up as an Error
  // and the wrapper renders the error state with the parse failure text.
  return parse(raw);
}

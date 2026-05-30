/**
 * Tests for the pure lazyFetch helper extracted from <LazyContent>.
 * Covers parse-on-success, structured 5xx errors, malformed JSON, parse
 * throws, and AbortSignal propagation. No DOM / no React.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazyFetch } from './lazy-fetch';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('lazyFetch — happy path', () => {
  it('calls fetch with the supplied URL and AbortSignal', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockResponse({ hello: 'world' }));
    const ac = new AbortController();

    await lazyFetch('https://x/api/foo', (r) => r, ac.signal);

    expect(global.fetch).toHaveBeenCalledWith('https://x/api/foo', {
      signal: ac.signal,
    });
  });

  it('calls the parse function with the parsed JSON body', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockResponse({ name: 'belle-isle' }));
    const parse = vi.fn((raw) => raw);

    const result = await lazyFetch('https://x/api/foo', parse, new AbortController().signal);

    expect(parse).toHaveBeenCalledWith({ name: 'belle-isle' });
    expect(result).toEqual({ name: 'belle-isle' });
  });

  it('returns the parsed shape (parse can transform)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponse({ count: 7 }),
    );
    const parse = (raw: unknown) => {
      const r = raw as { count: number };
      return { doubled: r.count * 2 };
    };

    const result = await lazyFetch(
      'https://x/api/foo',
      parse,
      new AbortController().signal,
    );

    expect(result).toEqual({ doubled: 14 });
  });
});

describe('lazyFetch — server errors', () => {
  it('throws with the structured { error } body when 5xx returns JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponse({ error: 'AI service unavailable' }, { status: 502 }),
    );

    await expect(
      lazyFetch('https://x/api/foo', (r) => r, new AbortController().signal),
    ).rejects.toThrow('AI service unavailable');
  });

  it('throws with a generic status-code message when 5xx body is not JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('plain text body', { status: 503 }),
    );

    await expect(
      lazyFetch('https://x/api/foo', (r) => r, new AbortController().signal),
    ).rejects.toThrow('Request failed (503)');
  });

  it('throws with the status-code message when 4xx body has no error field', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      mockResponse({ issues: { date: 'invalid' } }, { status: 400 }),
    );

    await expect(
      lazyFetch('https://x/api/foo', (r) => r, new AbortController().signal),
    ).rejects.toThrow('Request failed (400)');
  });
});

describe('lazyFetch — parse errors', () => {
  it('propagates errors thrown by the parse function', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockResponse({ wrong: 'shape' }));
    const parse = () => {
      throw new Error('Schema validation failed');
    };

    await expect(
      lazyFetch('https://x/api/foo', parse, new AbortController().signal),
    ).rejects.toThrow('Schema validation failed');
  });
});

describe('lazyFetch — AbortSignal', () => {
  it('propagates the signal to fetch — aborting before the call throws AbortError', async () => {
    const ac = new AbortController();
    ac.abort(); // pre-abort

    // The real fetch would honour the pre-aborted signal and throw an
    // AbortError. The vitest mock doesn't — but we can verify the signal
    // was wired by intercepting the call.
    let receivedSignal: AbortSignal | undefined;
    vi.mocked(global.fetch).mockImplementation((_url, init) => {
      receivedSignal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
      // Simulate the runtime's pre-aborted behaviour to keep the test
      // honest end-to-end:
      if (receivedSignal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
      return Promise.resolve(mockResponse({ ok: true }));
    });

    await expect(
      lazyFetch('https://x/api/foo', (r) => r, ac.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(receivedSignal).toBe(ac.signal);
    expect(receivedSignal?.aborted).toBe(true);
  });
});

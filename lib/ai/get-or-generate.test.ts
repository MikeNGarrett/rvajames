/**
 * Tests for the SEC-3 generation gate (single-flight lock + daily cost
 * circuit breaker) in lib/ai/get-or-generate.ts.
 *
 * runGenerationGate is fully injected, so the race logic is exercised here
 * without Supabase or Anthropic. The hash-quantization half of SEC-3 is
 * covered next to the hash fixtures in lib/ai/prompts/*.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import { runGenerationGate, type GenerationGate } from './get-or-generate';

const instantSleep = () => Promise.resolve();

function makeGate(overrides: Partial<GenerationGate<string>> = {}): GenerationGate<string> {
  return {
    isCeilingTripped: vi.fn().mockResolvedValue(false),
    tryAcquire: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
    readCache: vi.fn().mockResolvedValue(null),
    generate: vi.fn().mockResolvedValue('GENERATED'),
    readStale: vi.fn().mockResolvedValue('STALE'),
    sleep: instantSleep,
    ...overrides,
  };
}

describe('runGenerationGate — winner path', () => {
  it('generates exactly once and releases the lock', async () => {
    const gate = makeGate();
    expect(await runGenerationGate(gate)).toBe('GENERATED');
    expect(gate.generate).toHaveBeenCalledOnce();
    expect(gate.release).toHaveBeenCalledOnce();
  });

  it('double-checks the cache after winning — no generation if a row landed', async () => {
    const gate = makeGate({ readCache: vi.fn().mockResolvedValue('ALREADY_CACHED') });
    expect(await runGenerationGate(gate)).toBe('ALREADY_CACHED');
    expect(gate.generate).not.toHaveBeenCalled();
    expect(gate.release).toHaveBeenCalledOnce();
  });

  it('serves stale and still releases when generation throws', async () => {
    const gate = makeGate({ generate: vi.fn().mockRejectedValue(new Error('anthropic 529')) });
    expect(await runGenerationGate(gate)).toBe('STALE');
    expect(gate.release).toHaveBeenCalledOnce();
  });
});

describe('runGenerationGate — loser path (single flight)', () => {
  it('polls until the winner persists, then returns the cached row', async () => {
    const readCache = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue('WINNER_ROW');
    const gate = makeGate({ tryAcquire: vi.fn().mockResolvedValue(false), readCache });

    expect(await runGenerationGate(gate)).toBe('WINNER_ROW');
    expect(gate.generate).not.toHaveBeenCalled();
    // Losers never claimed the lock, so they must not release it either.
    expect(gate.release).not.toHaveBeenCalled();
  });

  it('falls back to stale when polling exhausts without a row', async () => {
    const gate = makeGate({ tryAcquire: vi.fn().mockResolvedValue(false) });
    expect(await runGenerationGate(gate)).toBe('STALE');
    expect(gate.generate).not.toHaveBeenCalled();
  });
});

describe('runGenerationGate — daily cost circuit breaker', () => {
  it('serves stale with zero generation attempts when tripped', async () => {
    const gate = makeGate({ isCeilingTripped: vi.fn().mockResolvedValue(true) });
    expect(await runGenerationGate(gate)).toBe('STALE');
    expect(gate.tryAcquire).not.toHaveBeenCalled();
    expect(gate.generate).not.toHaveBeenCalled();
  });

  it('returns null when tripped and no stale row exists', async () => {
    const gate = makeGate({
      isCeilingTripped: vi.fn().mockResolvedValue(true),
      readStale: vi.fn().mockResolvedValue(null),
    });
    expect(await runGenerationGate(gate)).toBeNull();
  });
});

describe('runGenerationGate — SEC-3 acceptance: N concurrent misses → 1 call', () => {
  it('50 concurrent requests for one uncached key produce exactly 1 generation', async () => {
    // Shared state stands in for Postgres: the lock flips synchronously
    // (atomic within the event loop, like the PRIMARY KEY insert), and the
    // cache row appears only after the winner's simulated Anthropic latency.
    let locked = false;
    let cacheRow: string | null = null;
    let generateCalls = 0;

    const mkGate = (): GenerationGate<string> => ({
      isCeilingTripped: async () => false,
      tryAcquire: async () => {
        if (locked) return false;
        locked = true;
        return true;
      },
      release: async () => {
        locked = false;
      },
      readCache: async () => cacheRow,
      generate: async () => {
        generateCalls++;
        await new Promise((r) => setTimeout(r, 5));
        cacheRow = 'RESULT';
        return 'RESULT';
      },
      readStale: async () => null,
      sleep: () => new Promise((r) => setTimeout(r, 1)),
    });

    const results = await Promise.all(
      Array.from({ length: 50 }, () => runGenerationGate(mkGate())),
    );

    expect(generateCalls).toBe(1);
    expect(results.every((r) => r === 'RESULT')).toBe(true);
  });
});

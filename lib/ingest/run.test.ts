/**
 * Tests for withIngestionRun — Finding 18.
 *
 * Verifies that a failed initial INSERT into ingestion_runs:
 *   - Is logged to console.error (observable in wrangler tail / CI logs)
 *   - Does NOT prevent the wrapped fn from running
 *   - Does NOT change the return value — result still comes from fn
 *
 * The wrapped fn's own errors are always captured in result.error (existing behaviour).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock calls are hoisted above imports by vitest's transform — declare before imports.
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';
import { withIngestionRun, type RunResult } from './run';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase client double that handles the two query chains
 * used by withIngestionRun:
 *   INSERT … SELECT … single()   — the audit-row creation
 *   UPDATE … eq()                — the audit-row finalisation
 */
function makeMockClient({ insertShouldFail = false } = {}) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

  const insertSingle = vi.fn().mockResolvedValue(
    insertShouldFail
      ? { data: null, error: { message: 'DB connection refused' } }
      : { data: { id: 'mock-run-id' }, error: null },
  );
  const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingle });
  const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

  const fromFn = vi.fn().mockReturnValue({
    insert: insertFn,
    update: updateFn,
  });

  return {
    from: fromFn,
    /** Exposed for assertions — the update mock inside the builder */
    _updateFn: updateFn,
    _updateEq: updateEq,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('withIngestionRun', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Silence console.error output while still letting us assert on calls.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  // ── Finding 18: INSERT failure is observable ────────────────────────────────

  it('logs console.error and still executes fn when initial INSERT fails', async () => {
    const mockClient = makeMockClient({ insertShouldFail: true });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const fn = vi.fn<() => Promise<RunResult>>().mockResolvedValue({
      ok: true,
      rowsWritten: 7,
    });

    const result = await withIngestionRun('usgs', fn);

    // fn ran despite the INSERT failure
    expect(fn).toHaveBeenCalledOnce();

    // result comes from fn, not from the INSERT error
    expect(result).toEqual({ ok: true, rowsWritten: 7 });

    // failure is observable — not silently swallowed
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[withIngestionRun]'),
      expect.stringContaining('DB connection refused'),
    );
  });

  it('does not call console.error when INSERT succeeds', async () => {
    const mockClient = makeMockClient({ insertShouldFail: false });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const fn = vi.fn<() => Promise<RunResult>>().mockResolvedValue({
      ok: true,
      rowsWritten: 2,
    });

    await withIngestionRun('nws', fn);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // ── UPDATE is attempted when a run row was created ──────────────────────────

  it('updates the audit row with the fn result on success', async () => {
    const mockClient = makeMockClient({ insertShouldFail: false });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const fn = vi.fn<() => Promise<RunResult>>().mockResolvedValue({
      ok: true,
      rowsWritten: 3,
    });

    const result = await withIngestionRun('jra', fn);

    expect(result).toEqual({ ok: true, rowsWritten: 3 });
    // UPDATE was called (audit row finalised)
    expect(mockClient._updateFn).toHaveBeenCalled();
    expect(mockClient._updateEq).toHaveBeenCalledWith('id', 'mock-run-id');
  });

  it('skips UPDATE when INSERT failed (no run id to target)', async () => {
    const mockClient = makeMockClient({ insertShouldFail: true });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const fn = vi.fn<() => Promise<RunResult>>().mockResolvedValue({
      ok: true,
      rowsWritten: 0,
    });

    await withIngestionRun('cso', fn);

    // No run id — UPDATE must not be attempted
    expect(mockClient._updateFn).not.toHaveBeenCalled();
  });

  // ── fn errors are captured, not propagated ─────────────────────────────────

  it('captures fn throw in result.error and returns ok:false', async () => {
    const mockClient = makeMockClient({ insertShouldFail: false });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const fn = vi.fn<() => Promise<RunResult>>().mockRejectedValue(
      new Error('USGS upstream timeout'),
    );

    const result = await withIngestionRun('usgs', fn);

    expect(result.ok).toBe(false);
    expect(result.rowsWritten).toBe(0);
    expect(result.error).toContain('USGS upstream timeout');
    // fn error should NOT be re-logged as an INSERT error
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

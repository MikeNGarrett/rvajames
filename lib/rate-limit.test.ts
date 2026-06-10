/**
 * Tests for lib/rate-limit.ts (SEC-2).
 *
 * checkRateLimit is exercised with an injected fake limiter (the real binding
 * only exists inside a Worker). enforceRateLimit is verified to no-op when no
 * Cloudflare context is available — the vitest/next-dev environment.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  rateLimitKey,
  checkRateLimit,
  enforceRateLimit,
  type RateLimiterBinding,
} from './rate-limit';

function req(path: string, ip?: string): Request {
  return new Request(`https://rvajames.org${path}`, {
    headers: ip ? { 'cf-connecting-ip': ip } : {},
  });
}

describe('rateLimitKey', () => {
  it('combines client IP and pathname', () => {
    expect(rateLimitKey(req('/api/metro-summary?date=2026-06-10&age=6-9', '203.0.113.7')))
      .toBe('203.0.113.7:/api/metro-summary');
  });

  it('gives each route its own bucket for the same IP', () => {
    const a = rateLimitKey(req('/api/metro-summary', '203.0.113.7'));
    const b = rateLimitKey(req('/api/location-interpretation', '203.0.113.7'));
    expect(a).not.toBe(b);
  });

  it('falls back to a sentinel when cf-connecting-ip is absent', () => {
    expect(rateLimitKey(req('/api/cron/usgs'))).toBe('no-ip:/api/cron/usgs');
  });
});

describe('checkRateLimit', () => {
  it('returns null when the limiter allows the request', async () => {
    const limiter: RateLimiterBinding = {
      limit: vi.fn().mockResolvedValue({ success: true }),
    };
    expect(await checkRateLimit(limiter, req('/api/metro-summary', '1.2.3.4'))).toBeNull();
    expect(limiter.limit).toHaveBeenCalledWith({ key: '1.2.3.4:/api/metro-summary' });
  });

  it('returns 429 + Retry-After when over the limit', async () => {
    const limiter: RateLimiterBinding = {
      limit: vi.fn().mockResolvedValue({ success: false }),
    };
    const res = await checkRateLimit(limiter, req('/api/metro-summary', '1.2.3.4'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get('Retry-After')).toBe('60');
    const body = (await res!.json()) as { error: string };
    expect(body.error).toMatch(/too many requests/i);
  });

  it('fails OPEN when the limiter throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter: RateLimiterBinding = {
      limit: vi.fn().mockRejectedValue(new Error('binding exploded')),
    };
    expect(await checkRateLimit(limiter, req('/api/metro-summary', '1.2.3.4'))).toBeNull();
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});

describe('enforceRateLimit', () => {
  it('no-ops (allows) outside a Worker context', async () => {
    // vitest has no Cloudflare context — getCloudflareContext throws and the
    // helper must allow the request rather than break local dev/tests.
    expect(await enforceRateLimit(req('/api/metro-summary', '1.2.3.4'), 'PUBLIC_RATE_LIMITER')).toBeNull();
  });
});

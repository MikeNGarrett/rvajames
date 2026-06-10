/**
 * In-Worker rate limiting via the Cloudflare Workers Rate Limiting binding
 * (SEC-2, security audit 2026-06-09).
 *
 * Two limiters are declared in wrangler.jsonc under `ratelimits`:
 *   PUBLIC_RATE_LIMITER — modest bucket for the public AI routes
 *                         (/api/metro-summary, /api/location-interpretation)
 *   CRON_RATE_LIMITER   — tight bucket for unauthorized hits on /api/cron/*
 *
 * Keys are `<client-ip>:<pathname>`, so each route gets its own per-IP bucket
 * and a flood on one route can't starve another. Cloudflare sets
 * `cf-connecting-ip` on every request that traverses the edge — the only path
 * to this Worker (*.workers.dev is disabled). The cron scheduled() handler
 * dispatches internally with a valid x-cron-secret and is checked BEFORE the
 * limiter, so scheduled triggers are never throttled.
 *
 * Behavior notes:
 *   - The binding is per-colo and eventually consistent — this is abuse
 *     damping, not precise accounting. That's the right trade-off here.
 *   - Absent binding (next dev, vitest, preview without the binding) → no-op.
 *   - Limiter errors fail OPEN: a broken limiter must not take the site down.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';

/** Shape of the binding declared via the wrangler `ratelimits` config key. */
export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type RateLimiterName = 'PUBLIC_RATE_LIMITER' | 'CRON_RATE_LIMITER';

// Both limiters use a 60-second period (the binding only supports 10 or 60).
const RETRY_AFTER_SECONDS = 60;

/** Per-IP, per-route bucket key. */
export function rateLimitKey(request: Request): string {
  const ip = request.headers.get('cf-connecting-ip') ?? 'no-ip';
  const path = new URL(request.url).pathname;
  return `${ip}:${path}`;
}

/**
 * Run `request` through `limiter`. Returns a 429 Response when over the
 * limit, null when allowed (or when the limiter itself errors — fail open).
 */
export async function checkRateLimit(
  limiter: RateLimiterBinding,
  request: Request,
): Promise<Response | null> {
  let success: boolean;
  try {
    ({ success } = await limiter.limit({ key: rateLimitKey(request) }));
  } catch (err) {
    console.error('[rate-limit] limiter.limit threw — failing open:', err);
    return null;
  }

  if (success) return null;

  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'Retry-After': String(RETRY_AFTER_SECONDS),
    },
  });
}

/**
 * Resolve the named limiter binding from the Worker env and apply it.
 * Returns null (allow) when the binding isn't available — next dev and
 * vitest have no Worker context.
 */
export async function enforceRateLimit(
  request: Request,
  name: RateLimiterName,
): Promise<Response | null> {
  let limiter: RateLimiterBinding | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const candidate = (env as Record<string, unknown>)[name];
    if (
      candidate &&
      typeof (candidate as RateLimiterBinding).limit === 'function'
    ) {
      limiter = candidate as RateLimiterBinding;
    }
  } catch {
    // No Cloudflare context (next dev / tests) — run unlimited.
  }

  if (!limiter) return null;
  return checkRateLimit(limiter, request);
}

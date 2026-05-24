import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware — runs on every matched request in the Cloudflare Worker.
 *
 * Responsibilities:
 *   1. BF-Cache: strip `no-store` by emitting `no-cache` instead, so the browser
 *      can restore pages from the back/forward cache. (Finding 6)
 *   2. Security headers — Phase 1 quick wins. (Finding 8)
 *      guides: security, performance
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ── BF-Cache (Finding 6) ──────────────────────────────────────────────────
  // `no-cache` allows BF-Cache while still requiring server revalidation.
  // Applies to page routes only; API/cron routes are excluded via matcher.
  response.headers.set('Cache-Control', 'no-cache');

  // ── Security headers (Finding 8) ─────────────────────────────────────────
  // Phase 1 quick wins — zero breakage risk for this app.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - /api/      — cron + data endpoints; let Next.js control their headers
     *   - /_next/    — static assets handled separately in next.config.ts
     *   - /favicon.ico, /icon.png — static metadata files
     */
    '/((?!api/|_next/|favicon\\.ico|icon\\.png).*)',
  ],
};

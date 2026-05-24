import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware — runs on every matched request in the Cloudflare Worker.
 *
 * Responsibilities:
 *   1. BF-Cache: strip `no-store` by emitting `no-cache` instead, so the browser
 *      can restore pages from the back/forward cache. (Finding 6)
 *   2. Security headers — Phase 1 quick wins. (Finding 8)
 *   3. CSP Report-Only — Finding 17. Report-Only mode means no blocking; the
 *      browser logs violations to the console so we can tighten up before
 *      switching to enforcement. Notes on each directive:
 *
 *      script-src  'unsafe-inline' — Next.js App Router emits inline hydration
 *                  scripts (__NEXT_DATA__ etc.). A nonce-based approach is the
 *                  correct long-term fix but requires regenerating a nonce per
 *                  request in middleware and threading it through the app.
 *                  Deferred to a future round; 'unsafe-inline' is the honest
 *                  baseline that reflects current reality.
 *      connect-src — Supabase JS client is server-only in this app, but the
 *                  `NEXT_PUBLIC_SUPABASE_URL` token is available to the browser
 *                  bundle; allow it as a precaution. Include wss: for Realtime
 *                  if it is ever switched on.
 *      img-src     data: — status-badge inline SVGs use data URIs.
 *      font-src    'self' — Nunito Sans is self-hosted via next/font/google.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ── BF-Cache (Finding 6) ──────────────────────────────────────────────────
  response.headers.set('Cache-Control', 'no-cache');

  // ── Security headers (Finding 8) ─────────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );

  // ── CSP Report-Only (Finding 17) ─────────────────────────────────────────
  response.headers.set(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://buokjdntsitjpqfjxano.supabase.co wss://buokjdntsitjpqfjxano.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
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

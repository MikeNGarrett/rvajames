import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware — runs on every matched request in the Cloudflare Worker.
 *
 * Responsibilities:
 *   1. Cache-Control: shared CDN cache for public pages (URL is the key, no
 *      user-specific content), restrictive for /admin/*. Originally `no-cache`
 *      per Finding 6 — that fixed BFCache but disabled all edge caching, which
 *      made every chip click a cold worker hit + lazy AI generation (~10–20s
 *      for uncached combos). With short s-maxage + SWR, repeat visits to the
 *      same URL are served instantly from the Cloudflare edge.
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
  const { pathname } = request.nextUrl;

  // ── Cache-Control ─────────────────────────────────────────────────────────
  // Public pages: edge-cache 60s + stale-while-revalidate 300s.
  //   - s-maxage=60: Cloudflare CDN holds the rendered HTML for 60s. USGS data
  //     refreshes every 15 min, so 60s edge TTL is 15× over-sampled.
  //   - stale-while-revalidate=300: serve stale up to 5 min beyond, regenerate
  //     in background. Eliminates wait time on chip clicks that land just past
  //     s-maxage.
  //   - No `max-age`: browser revalidates on each navigation (fresh data when
  //     user explicitly navigates). BFCache + prefetch are independent of
  //     max-age and continue to work.
  //   - `public`: allow shared caches. URL (including ?date and ?age) is the
  //     cache key; same URL produces the same content for all users.
  //   - No `no-store`: preserves BFCache (Finding 6 fix retained).
  //
  // Admin pages: restrictive. Behind Cloudflare Access but defense-in-depth.
  if (pathname.startsWith('/admin')) {
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate',
    );
  } else {
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );
  }

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
      // Cloudflare Web Analytics beacon is injected by Cloudflare edge (Finding 10).
      // Include its CDN in script-src and its reporting endpoint in connect-src so
      // these don't generate violations when we eventually enforce the policy.
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://buokjdntsitjpqfjxano.supabase.co wss://buokjdntsitjpqfjxano.supabase.co https://cloudflareinsights.com",
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

import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import {
  getAllowedAdminEmails,
  getCfAccessAud,
  getCfAccessTeamDomain,
} from '@/lib/env';

/**
 * Admin identity for /admin/* — SEC-1 (security audit 2026-06-09).
 *
 * In production the admin email is derived ONLY from the signed
 * `Cf-Access-Jwt-Assertion` token that Cloudflare Access attaches at the edge:
 * signature verified against the team JWKS, `aud` checked against the Access
 * application's AUD tag, `iss`/`exp`/`nbf` enforced. The plaintext
 * `cf-access-authenticated-user-email` header is never trusted when
 * verification is active — a spoofed header without a valid JWT gets 403.
 *
 * JWT verification is SKIPPED (header fallback, as before SEC-1) when either:
 *   - CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD are unset, or
 *   - NODE_ENV !== 'production' (next dev has no Access edge).
 * Either way the ALLOWED_ADMIN_EMAILS allowlist remains the second gate.
 */

// JWKS resolver cached per team domain — jose's createRemoteJWKSet handles
// fetch caching + key rotation internally; reuse the instance across requests
// within an isolate.
let cachedJwks: { domain: string; getKey: JWTVerifyGetKey } | null = null;

/** @internal Test seam — lets tests verify real signatures without a remote JWKS fetch. */
let jwksOverride: JWTVerifyGetKey | null = null;
export function __setJwksOverrideForTest(getKey: JWTVerifyGetKey | null): void {
  jwksOverride = getKey;
}

function jwksForDomain(domain: string): JWTVerifyGetKey {
  if (jwksOverride) return jwksOverride;
  if (cachedJwks?.domain !== domain) {
    cachedJwks = {
      domain,
      getKey: createRemoteJWKSet(
        new URL(`https://${domain}/cdn-cgi/access/certs`),
      ),
    };
  }
  return cachedJwks.getKey;
}

/**
 * Verify a Cloudflare Access JWT and return its email claim, or null when the
 * token is missing, unsigned, expired, or carries the wrong aud/iss.
 *
 * @internal Exported for tests; production callers go through getAdminEmail().
 */
export async function verifyAccessJwt(
  token: string | null,
  teamDomain: string,
  aud: string,
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwksForDomain(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    return typeof payload.email === 'string' ? payload.email : null;
  } catch (err) {
    // Verification failures are expected noise from probes — log compactly.
    console.error(
      '[admin-auth] Access JWT verification failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Extract the Access token: header first, CF_Authorization cookie fallback. */
function readAccessToken(headersList: Headers): string | null {
  const header = headersList.get('cf-access-jwt-assertion');
  if (header) return header;
  const cookie = headersList.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Returns the authenticated admin email, or null when unauthorized.
 *
 * Production: verified Access JWT → email claim → ALLOWED_ADMIN_EMAILS gate.
 * Local dev (no CF_ACCESS_* vars or non-production): the
 * `cf-access-authenticated-user-email` header → same allowlist gate.
 * See DEPLOYMENT.md § Local testing.
 */
export async function getAdminEmail(): Promise<string | null> {
  const headersList = await headers();
  const teamDomain = await getCfAccessTeamDomain();
  const aud = await getCfAccessAud();

  let email: string | null;
  if (teamDomain && aud && process.env.NODE_ENV === 'production') {
    email = await verifyAccessJwt(
      readAccessToken(headersList as unknown as Headers),
      teamDomain,
      aud,
    );
  } else {
    email = headersList.get('cf-access-authenticated-user-email');
  }
  if (!email) return null;

  const allowedEmails = await getAllowedAdminEmails();
  if (!allowedEmails.includes(email.toLowerCase())) return null;

  return email;
}

/**
 * Same as getAdminEmail() but throws a 403 response if not authorized.
 * Use in SERVER ACTIONS (app/admin/closures/actions.ts), where a thrown
 * Response maps to the action's HTTP status. For Server Component renders
 * use requireAdminPage() instead — a Response thrown during a page render
 * surfaces as a 500 error boundary, not a 403.
 */
export async function requireAdminEmail(): Promise<string> {
  const email = await getAdminEmail();
  if (!email) {
    // Cloudflare Access blocks unauthenticated requests at the edge before
    // they reach the Worker; this in-Worker verification is the
    // defence-in-depth layer that survives an edge misconfiguration.
    throw new Response('Forbidden — admin access required', { status: 403 });
  }
  return email;
}

/**
 * Page-render variant of requireAdminEmail(): unauthorized requests get
 * Next's forbidden() auth interrupt, which renders app/forbidden.tsx with a
 * real HTTP 403 (requires experimental.authInterrupts in next.config.mjs).
 * Use in admin layouts/pages; keep requireAdminEmail() for server actions.
 */
export async function requireAdminPage(): Promise<string> {
  const email = await getAdminEmail();
  if (!email) forbidden();
  return email;
}

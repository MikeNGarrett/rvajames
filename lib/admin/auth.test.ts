/**
 * SEC-1 tests — Cloudflare Access JWT validation for /admin.
 *
 * Uses REAL crypto: an RS256 key pair generated in-test signs genuine JWTs,
 * and the module's JWKS test seam verifies against the matching public key —
 * so signature, aud, iss, and exp enforcement are all exercised for real.
 *
 * Acceptance criteria covered:
 *   - spoofed cf-access-authenticated-user-email header only (no JWT) → 403
 *   - valid Access JWT + allowlisted email → passes
 *   - valid Access JWT + non-allowlisted email → 403
 *   - local-dev path (no CF_ACCESS_* vars) → header fallback still works
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { SignJWT, generateKeyPair } from 'jose';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  getAllowedAdminEmails: vi.fn(),
  getCfAccessTeamDomain: vi.fn(),
  getCfAccessAud: vi.fn(),
}));

import { headers } from 'next/headers';
import {
  getAllowedAdminEmails,
  getCfAccessAud,
  getCfAccessTeamDomain,
} from '@/lib/env';
import {
  getAdminEmail,
  requireAdminEmail,
  verifyAccessJwt,
  __setJwksOverrideForTest,
} from './auth';

const TEAM = 'rvajames.cloudflareaccess.com';
const AUD = 'aud-tag-0123456789abcdef';
const ADMIN = 'mike@example.com';

let privateKey: CryptoKey;
let publicKey: CryptoKey;

beforeAll(async () => {
  ({ privateKey, publicKey } = await generateKeyPair('RS256'));
});

function makeHeaders(record: Record<string, string>): { get(name: string): string | null } {
  const lower = Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

async function signToken(overrides: {
  email?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string | number;
} = {}): Promise<string> {
  return new SignJWT({ email: overrides.email ?? ADMIN })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(overrides.issuer ?? `https://${TEAM}`)
    .setAudience(overrides.audience ?? AUD)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '5m')
    .sign(privateKey);
}

beforeEach(() => {
  __setJwksOverrideForTest(async () => publicKey);
  vi.mocked(getAllowedAdminEmails).mockResolvedValue([ADMIN]);
  vi.mocked(getCfAccessTeamDomain).mockResolvedValue(TEAM);
  vi.mocked(getCfAccessAud).mockResolvedValue(AUD);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  __setJwksOverrideForTest(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── verifyAccessJwt ──────────────────────────────────────────────────────────

describe('verifyAccessJwt', () => {
  it('returns the email claim for a validly signed token', async () => {
    expect(await verifyAccessJwt(await signToken(), TEAM, AUD)).toBe(ADMIN);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signToken({ audience: 'some-other-app' });
    expect(await verifyAccessJwt(token, TEAM, AUD)).toBeNull();
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await signToken({ issuer: 'https://attacker.cloudflareaccess.com' });
    expect(await verifyAccessJwt(token, TEAM, AUD)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signToken({ expiresIn: Math.floor(Date.now() / 1000) - 60 });
    expect(await verifyAccessJwt(token, TEAM, AUD)).toBeNull();
  });

  it('rejects a token signed by a different key', async () => {
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ email: ADMIN })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(`https://${TEAM}`)
      .setAudience(AUD)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(otherKey);
    expect(await verifyAccessJwt(token, TEAM, AUD)).toBeNull();
  });

  it('rejects garbage and missing tokens', async () => {
    expect(await verifyAccessJwt('not.a.jwt', TEAM, AUD)).toBeNull();
    expect(await verifyAccessJwt(null, TEAM, AUD)).toBeNull();
  });
});

// ─── getAdminEmail — production enforcement ───────────────────────────────────

describe('getAdminEmail — JWT enforcement (CF_ACCESS_* set, production)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('AC: a spoofed email header with NO valid JWT is rejected', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({ 'cf-access-authenticated-user-email': ADMIN }) as never,
    );
    expect(await getAdminEmail()).toBeNull();
    await expect(requireAdminEmail()).rejects.toSatisfy(
      (r) => r instanceof Response && r.status === 403,
    );
  });

  it('AC: a valid JWT with an allowlisted email passes', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({ 'cf-access-jwt-assertion': await signToken() }) as never,
    );
    expect(await getAdminEmail()).toBe(ADMIN);
  });

  it('AC: a valid JWT with a non-allowlisted email is rejected', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({
        'cf-access-jwt-assertion': await signToken({ email: 'intruder@example.com' }),
      }) as never,
    );
    expect(await getAdminEmail()).toBeNull();
    await expect(requireAdminEmail()).rejects.toSatisfy(
      (r) => r instanceof Response && r.status === 403,
    );
  });

  it('the email header is ignored even when a valid JWT is present (JWT wins)', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({
        'cf-access-jwt-assertion': await signToken(),
        'cf-access-authenticated-user-email': 'spoofed@example.com',
      }) as never,
    );
    expect(await getAdminEmail()).toBe(ADMIN);
  });

  it('accepts the token from the CF_Authorization cookie fallback', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({ cookie: `theme=dark; CF_Authorization=${await signToken()}` }) as never,
    );
    expect(await getAdminEmail()).toBe(ADMIN);
  });
});

// ─── getAdminEmail — local-dev fallback ───────────────────────────────────────

describe('getAdminEmail — local fallback (no CF_ACCESS_* vars)', () => {
  beforeEach(() => {
    vi.mocked(getCfAccessTeamDomain).mockResolvedValue(null);
    vi.mocked(getCfAccessAud).mockResolvedValue(null);
  });

  it('honors the header when the email is allowlisted (DEPLOYMENT.md local testing)', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({ 'cf-access-authenticated-user-email': ADMIN }) as never,
    );
    expect(await getAdminEmail()).toBe(ADMIN);
  });

  it('still applies the allowlist gate', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({ 'cf-access-authenticated-user-email': 'intruder@example.com' }) as never,
    );
    expect(await getAdminEmail()).toBeNull();
  });

  it('returns null with no header at all', async () => {
    vi.mocked(headers).mockResolvedValue(makeHeaders({}) as never);
    expect(await getAdminEmail()).toBeNull();
  });
});

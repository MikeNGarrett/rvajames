import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Returns the raw environment bindings.
 *
 * In production and `opennextjs-cloudflare preview` (wrangler dev), env lives in
 * the Cloudflare Worker context. In `next dev` it falls back to process.env.
 */
async function getEnv(): Promise<Record<string, string | undefined>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as Record<string, string | undefined>;
  } catch {
    return process.env as Record<string, string | undefined>;
  }
}

export async function getSupabaseUrl(): Promise<string> {
  const env = await getEnv();
  const val = env['SUPABASE_URL'] ?? env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!val) throw new Error('SUPABASE_URL is not set');
  return val;
}

export async function getSupabaseAnonKey(): Promise<string> {
  const env = await getEnv();
  const val = env['SUPABASE_ANON_KEY'] ?? env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!val) throw new Error('SUPABASE_ANON_KEY is not set');
  return val;
}

export async function getSupabaseServiceRoleKey(): Promise<string> {
  const env = await getEnv();
  const val = env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!val) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return val;
}

// Removed 2026-06-05: getNextPublicSupabaseUrl + getNextPublicSupabaseAnonKey.
// Both were duplicates — getSupabaseUrl + getSupabaseAnonKey above already
// fall back to NEXT_PUBLIC_* when the unprefixed name is unset, and neither
// was called from anywhere in the codebase. See docs/cleanup-audit-2026-06-05.md.

export async function getAnthropicApiKey(): Promise<string> {
  const env = await getEnv();
  const val = env['ANTHROPIC_API_KEY'];
  if (!val) throw new Error('ANTHROPIC_API_KEY is not set');
  return val;
}

/**
 * Returns the comma-separated list of allowed admin email addresses.
 * Whitespace-trimmed. Returns empty array if not set (blocks all access).
 */
export async function getAllowedAdminEmails(): Promise<string[]> {
  const env = await getEnv();
  const val = env['ALLOWED_ADMIN_EMAILS'] ?? '';
  return val
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Daily Anthropic spend ceiling in USD (SEC-3 circuit breaker). Above this,
 * public routes serve stale/deterministic content and skip generation until
 * the next UTC day. Configured via the AI_DAILY_COST_CEILING_USD var in
 * wrangler.jsonc; defaults to $5 when unset or unparsable.
 */
export async function getAiDailyCostCeilingUsd(): Promise<number> {
  const env = await getEnv();
  const parsed = Number(env['AI_DAILY_COST_CEILING_USD']);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

/**
 * Cloudflare Access team domain for /admin JWT verification (SEC-1) — host
 * only, e.g. `myteam.cloudflareaccess.com`. A pasted scheme is tolerated and
 * stripped. Null when unset: local dev without the Access edge, where JWT
 * verification is skipped and the header fallback applies.
 */
export async function getCfAccessTeamDomain(): Promise<string | null> {
  const env = await getEnv();
  const raw = env['CF_ACCESS_TEAM_DOMAIN']?.trim();
  return raw ? raw.replace(/^https?:\/\//, '').replace(/\/+$/, '') : null;
}

/** Cloudflare Access Application Audience (AUD) tag of the /admin app (SEC-1). */
export async function getCfAccessAud(): Promise<string | null> {
  const env = await getEnv();
  const raw = env['CF_ACCESS_AUD']?.trim();
  return raw || null;
}

export async function getCronSecret(): Promise<string> {
  const env = await getEnv();
  const val = env['CRON_SECRET'];
  if (!val) throw new Error('CRON_SECRET is not set');
  return val;
}

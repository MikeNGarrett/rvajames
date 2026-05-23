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

export async function getNextPublicSupabaseUrl(): Promise<string> {
  const env = await getEnv();
  const val = env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!val) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return val;
}

export async function getNextPublicSupabaseAnonKey(): Promise<string> {
  const env = await getEnv();
  const val = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!val) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  return val;
}

export async function getAnthropicApiKey(): Promise<string> {
  const env = await getEnv();
  const val = env['ANTHROPIC_API_KEY'];
  if (!val) throw new Error('ANTHROPIC_API_KEY is not set');
  return val;
}

export async function getCronSecret(): Promise<string> {
  const env = await getEnv();
  const val = env['CRON_SECRET'];
  if (!val) throw new Error('CRON_SECRET is not set');
  return val;
}

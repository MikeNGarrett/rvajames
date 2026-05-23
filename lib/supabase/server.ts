import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';
import type { Database } from './types';

/**
 * Returns a fresh Supabase client scoped to a single request.
 * Never call this at module scope — always create per request.
 */
export async function createServerClient(
  role: 'anon' | 'service' = 'anon',
): Promise<ReturnType<typeof createClient<Database>>> {
  const url = await getSupabaseUrl();
  const key =
    role === 'service'
      ? await getSupabaseServiceRoleKey()
      : await getSupabaseAnonKey();

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

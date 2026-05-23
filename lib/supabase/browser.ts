import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Returns a fresh Supabase anon-key client for use in browser components.
 * Reads NEXT_PUBLIC_* env vars which are inlined at build time.
 * Never call this at module scope — always create per component render.
 */
export function createBrowserClient(): ReturnType<typeof createClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');

  return createClient<Database>(url, key);
}

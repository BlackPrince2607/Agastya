/**
 * Supabase client (optional). Lazy-init avoids auth touching storage during web SSR.
 * Same project/session strategy as backend (see backend/.env.example SUPABASE_*).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { isServerEnvironment, persistentStorage } from '@/services/persistentStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Client-only Supabase instance; null during web static SSR in Node. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey || isServerEnvironment()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: persistentStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export async function getSupabaseAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Supabase client (optional). Lazy-init avoids auth touching storage during web SSR.
 * Same project/session strategy as backend (see backend/.env.example SUPABASE_*).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { ensureWebCrypto } from '@/services/cryptoPolyfill';
import { isServerEnvironment, persistentStorage } from '@/services/persistentStorage';

ensureWebCrypto();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
let loggedMissingKeys = false;

function warnMissingSupabaseKeys(): void {
  if (!__DEV__ || loggedMissingKeys) return;
  if (supabaseUrl && supabaseAnonKey) {
    if (!supabaseAnonKey.startsWith('eyJ') && !supabaseAnonKey.startsWith('sb_publishable_')) {
      loggedMissingKeys = true;
      console.warn(
        '[Agastya auth] EXPO_PUBLIC_SUPABASE_ANON_KEY looks unusual — use the anon/publishable key from Supabase → Project Settings → API.',
      );
    }
    return;
  }
  loggedMissingKeys = true;
  console.warn('[Agastya auth] Sign-in disabled — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

/** Client-only Supabase instance; null during web static SSR in Node. */
export function getSupabase(): SupabaseClient | null {
  warnMissingSupabaseKeys();
  if (!supabaseUrl || !supabaseAnonKey || isServerEnvironment()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: persistentStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
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

/** Wait briefly for session storage to settle after OAuth / magic-link exchange. */
export async function waitForSupabaseAccessToken(maxMs = 4000): Promise<string | null> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const token = await getSupabaseAccessToken();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return getSupabaseAccessToken();
}

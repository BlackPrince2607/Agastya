import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';

import { getSupabase } from '@/services/supabase';

/** Parse magic-link / OAuth redirect URLs and establish a Supabase session. */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    console.warn('[Agastya auth]', errorCode);
    return false;
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token) return false;

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });
  if (error) {
    console.warn('[Agastya auth] setSession failed', error.message);
    return false;
  }
  return true;
}

/** Wire deep links (OTP + OAuth) — call once from root layout. */
export function subscribeAuthDeepLinks(): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const handle = (url: string | null) => {
    if (!url) return;
    void createSessionFromUrl(url);
  };

  void Linking.getInitialURL().then(handle);
  const sub = Linking.addEventListener('url', ({ url }) => handle(url));
  return () => sub.remove();
}

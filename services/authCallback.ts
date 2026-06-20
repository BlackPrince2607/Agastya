import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';

import { ensureSessionMerged } from '@/services/authMerge';
import { isAuthCallbackUrl } from '@/services/authRedirect';
import { getSupabase } from '@/services/supabase';
import { routeAfterSignInIntent } from '@/utils/navigationFlow';

export type AuthUrlResult =
  | { ok: true }
  | { ok: false; reason: 'no_client' | 'parse_error' | 'exchange_failed'; message?: string };

/** Parse magic-link / OAuth redirect URLs and establish a Supabase session. */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const result = await createSessionFromUrlDetailed(url);
  return result.ok;
}

export async function createSessionFromUrlDetailed(url: string): Promise<AuthUrlResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'no_client' };

  const { params, errorCode } = QueryParams.getQueryParams(url);

  const oauthError = params.error_description ?? params.error;
  if (errorCode || oauthError) {
    const message = oauthError ?? errorCode ?? 'Sign-in was cancelled.';
    console.warn('[Agastya auth]', message);
    return { ok: false, reason: 'parse_error', message };
  }

  const code = params.code;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[Agastya auth] exchangeCodeForSession failed', error.message);
      return { ok: false, reason: 'exchange_failed', message: error.message };
    }
    return { ok: true };
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token) {
    return { ok: false, reason: 'parse_error', message: 'No sign-in token in the link.' };
  }

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });
  if (error) {
    console.warn('[Agastya auth] setSession failed', error.message);
    return { ok: false, reason: 'exchange_failed', message: error.message };
  }
  return { ok: true };
}

/** Complete sign-in after a deep link: session → merge → route. */
export async function completeAuthFromUrl(url: string): Promise<AuthUrlResult> {
  const result = await createSessionFromUrlDetailed(url);
  if (!result.ok) return result;
  await ensureSessionMerged();
  await routeAfterSignInIntent();
  return { ok: true };
}

/** Wire deep links (OTP + OAuth) — call once from root layout. */
export function subscribeAuthDeepLinks(): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const handle = async (url: string | null) => {
    if (!url || !isAuthCallbackUrl(url)) return;
    await completeAuthFromUrl(url);
  };

  void Linking.getInitialURL().then((u) => void handle(u));
  const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
  return () => sub.remove();
}

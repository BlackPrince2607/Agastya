import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';

import { alertForAuthFailure, parseAuthFailure } from '@/services/authErrorUtils';
import { finishSignIn } from '@/services/authSignIn';
import { isAuthCallbackUrl } from '@/services/authRedirect';
import { getSupabase } from '@/services/supabase';

export type AuthUrlResult =
  | { ok: true; recovery?: boolean; skipped?: boolean }
  | { ok: false; reason: 'no_client' | 'parse_error' | 'exchange_failed'; message?: string };

const processedAuthUrls = new Set<string>();

function parseAuthQueryParams(url: string): { params: Record<string, string>; errorCode?: string } {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (params.code || params.access_token || params.error || params.error_description) {
    return { params, errorCode };
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const hashQuery = url.slice(hashIndex + 1);
    const fromHash = QueryParams.getQueryParams(`?${hashQuery}`);
    if (fromHash.params.code || fromHash.params.access_token || fromHash.params.error) {
      return { params: fromHash.params, errorCode: fromHash.errorCode };
    }
  }

  return { params, errorCode };
}

function isRecoveryUrl(url: string): boolean {
  const { params } = parseAuthQueryParams(url);
  return params.type === 'recovery';
}

/** Parse magic-link / OAuth redirect URLs and establish a Supabase session. */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const result = await createSessionFromUrlDetailed(url);
  return result.ok;
}

export async function createSessionFromUrlDetailed(url: string): Promise<AuthUrlResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'no_client' };

  const { params, errorCode } = parseAuthQueryParams(url);

  const oauthError = params.error_description ?? params.error;
  if (errorCode || oauthError) {
    const message = oauthError ?? errorCode ?? 'Sign-in was cancelled.';
    if (__DEV__) console.warn('[Agastya auth]', message);
    return { ok: false, reason: 'parse_error', message };
  }

  const code = params.code;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (__DEV__) console.warn('[Agastya auth] exchangeCodeForSession failed', error.message);
      return { ok: false, reason: 'exchange_failed', message: error.message };
    }
    return { ok: true, recovery: params.type === 'recovery' };
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
    if (__DEV__) console.warn('[Agastya auth] setSession failed', error.message);
    return { ok: false, reason: 'exchange_failed', message: error.message };
  }
  return { ok: true, recovery: params.type === 'recovery' };
}

/** Complete sign-in after a deep link: session → merge → route (or reset-password for recovery). */
export async function completeAuthFromUrl(url: string): Promise<AuthUrlResult> {
  if (processedAuthUrls.has(url)) {
    return { ok: true, skipped: true };
  }
  processedAuthUrls.add(url);

  const recovery = isRecoveryUrl(url);
  const result = await createSessionFromUrlDetailed(url);
  if (!result.ok) {
    processedAuthUrls.delete(url);
    return result;
  }

  if (recovery || result.recovery) {
    router.replace('/auth/reset-password');
    return { ok: true, recovery: true };
  }

  try {
    await finishSignIn();
  } catch (err) {
    processedAuthUrls.delete(url);
    const message = err instanceof Error ? err.message : 'Could not finish signing in.';
    return { ok: false, reason: 'exchange_failed', message };
  }

  return { ok: true };
}

/** Wire deep links (OTP + OAuth) — native only; web uses /auth/callback route. */
export function subscribeAuthDeepLinks(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const supabase = getSupabase();
  if (!supabase) return () => {};

  const handle = async (url: string | null) => {
    if (!url || !isAuthCallbackUrl(url)) return;
    const result = await completeAuthFromUrl(url);
    if (!result.ok && !result.skipped) {
      const alert = alertForAuthFailure(
        parseAuthFailure(result.message ?? 'We could not finish signing you in from that link.'),
      );
      Alert.alert(alert.title, alert.body);
    }
  };

  void Linking.getInitialURL().then((u) => void handle(u));
  const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
  return () => sub.remove();
}

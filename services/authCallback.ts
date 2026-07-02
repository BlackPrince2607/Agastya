import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { isAccountOAuthActive } from '@/services/authFlow';
import { isAuthCallbackUrl } from '@/services/authRedirect';
import { readAuthSession, syncAuthUserToStore } from '@/services/authSession';
import { getSupabase } from '@/services/supabase';

/** OAuth return URL from WebBrowser or a deep link (consumed once after successful exchange). */
let pendingAuthReturnUrl: string | null = null;

export function setPendingAuthReturnUrl(url: string) {
  pendingAuthReturnUrl = url;
}

export function peekPendingAuthReturnUrl(): string | null {
  return pendingAuthReturnUrl;
}

export function consumePendingAuthReturnUrl(): string | null {
  const url = pendingAuthReturnUrl;
  pendingAuthReturnUrl = null;
  return url;
}

/** Wait for an auth callback URL (magic link / cold start). Not used during account WebBrowser OAuth. */
export function waitForAuthReturnUrl(): Promise<string | null> {
  const pending = peekPendingAuthReturnUrl();
  if (pending) return Promise.resolve(pending);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      sub.remove();
      resolve(url);
    };

    void Linking.getInitialURL().then((initial) => {
      if (initial && isAuthCallbackUrl(initial)) {
        finish(initial);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isAuthCallbackUrl(url)) {
        setPendingAuthReturnUrl(url);
        finish(url);
      }
    });
  });
}

export type AuthUrlResult =
  | { ok: true; recovery?: boolean; skipped?: boolean; userId?: string | null }
  | { ok: false; reason: 'no_client' | 'parse_error' | 'exchange_failed'; message?: string };

const processedAuthUrls = new Set<string>();

function parseAuthQueryParams(url: string): { params: Record<string, string>; errorCode?: string } {
  const { params, errorCode: rawCode } = QueryParams.getQueryParams(url);
  const errorCode = rawCode ?? undefined;
  if (params.code || params.access_token || params.error || params.error_description) {
    return { params, errorCode };
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const hashQuery = url.slice(hashIndex + 1);
    const fromHash = QueryParams.getQueryParams(`?${hashQuery}`);
    if (fromHash.params.code || fromHash.params.access_token || fromHash.params.error) {
      return { params: fromHash.params, errorCode: fromHash.errorCode ?? undefined };
    }
  }

  return { params, errorCode };
}

function isRecoveryUrl(url: string): boolean {
  const { params } = parseAuthQueryParams(url);
  return params.type === 'recovery';
}

function applySessionUser(userId: string | undefined | null): string | null {
  const id = userId ?? null;
  syncAuthUserToStore(id);
  return id;
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (__DEV__) console.warn('[Agastya auth] exchangeCodeForSession failed', error.message);
      return { ok: false, reason: 'exchange_failed', message: error.message };
    }
    const userId = applySessionUser(data.session?.user?.id);
    return { ok: true, recovery: params.type === 'recovery', userId };
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token) {
    return { ok: false, reason: 'parse_error', message: 'No sign-in token in the link.' };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });
  if (error) {
    if (__DEV__) console.warn('[Agastya auth] setSession failed', error.message);
    return { ok: false, reason: 'exchange_failed', message: error.message };
  }
  const userId = applySessionUser(data.session?.user?.id);
  return { ok: true, recovery: params.type === 'recovery', userId };
}

/** Establish session from redirect URL. Caller handles navigation. */
export async function completeAuthFromUrl(url: string): Promise<AuthUrlResult> {
  if (processedAuthUrls.has(url)) {
    const auth = await readAuthSession();
    if (auth.isSignedIn) {
      return { ok: true, skipped: true, userId: auth.userId };
    }
    processedAuthUrls.delete(url);
  }

  processedAuthUrls.add(url);

  const recovery = isRecoveryUrl(url);
  const result = await createSessionFromUrlDetailed(url);
  if (!result.ok) {
    processedAuthUrls.delete(url);
    return result;
  }

  consumePendingAuthReturnUrl();

  if (recovery || result.recovery) {
    return { ok: true, recovery: true, userId: result.userId };
  }

  return { ok: true, userId: result.userId };
}

/** Wire deep links (OTP + magic link). Native OAuth on account screen is handled inline. */
export function subscribeAuthDeepLinks(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const supabase = getSupabase();
  if (!supabase) return () => {};

  const handle = (url: string | null) => {
    if (!url || !isAuthCallbackUrl(url)) return;
    setPendingAuthReturnUrl(url);
    if (isAccountOAuthActive()) {
      if (__DEV__) {
        console.log('[Agastya auth] deep link held for account OAuth handler');
      }
      return;
    }
    router.replace('/auth/callback');
  };

  void Linking.getInitialURL().then((u) => handle(u));
  const sub = Linking.addEventListener('url', ({ url }) => handle(url));
  return () => sub.remove();
}

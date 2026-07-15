import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { isRecentAuthEstablished } from '@/services/authFlow';
import {
  isAuthCallbackUrl,
  oauthRedirectMisconfigMessage,
  parseOAuthCallbackError,
} from '@/services/authRedirect';
import { syncAuthUserToStore } from '@/services/authSession';
import { dismissOAuthBrowser } from '@/services/oauthBrowser';
import { persistentStorage } from '@/services/persistentStorage';
import { getSupabase } from '@/services/supabase';

const PENDING_AUTH_URL_KEY = 'agastya:pending_auth_return_url';

export type AuthUrlResult =
  | { ok: true; recovery?: boolean; skipped?: boolean; userId?: string | null }
  | { ok: false; reason: 'no_client' | 'parse_error' | 'exchange_failed'; message?: string };

/** OAuth return URL from WebBrowser or a deep link (consumed once after successful exchange). */
let pendingAuthReturnUrl: string | null = null;
const processedAuthUrls = new Set<string>();
/** In-flight exchanges keyed by URL — prevents double PKCE redeem (deep link + browser result). */
const authUrlInFlight = new Map<string, Promise<AuthUrlResult>>();

export function setPendingAuthReturnUrl(url: string) {
  pendingAuthReturnUrl = url;
  void persistentStorage.setItem(PENDING_AUTH_URL_KEY, url).catch(() => {});
}

export function peekPendingAuthReturnUrl(): string | null {
  return pendingAuthReturnUrl;
}

export function consumePendingAuthReturnUrl(): string | null {
  const url = pendingAuthReturnUrl;
  pendingAuthReturnUrl = null;
  if (url) {
    void persistentStorage.removeItem(PENDING_AUTH_URL_KEY).catch(() => {});
  }
  return url;
}

/** Resolve OAuth/magic-link return URL after Custom Tabs or an exp:// reload. */
export async function resolveAuthCallbackUrl(): Promise<string | null> {
  const pending = peekPendingAuthReturnUrl();
  if (pending && isAuthCallbackUrl(pending)) {
    return pending;
  }

  try {
    const initial = await Linking.getInitialURL();
    if (initial && isAuthCallbackUrl(initial)) {
      setPendingAuthReturnUrl(initial);
      return initial;
    }
  } catch {
    /* ignore */
  }

  try {
    const stored = await persistentStorage.getItem(PENDING_AUTH_URL_KEY);
    if (stored && isAuthCallbackUrl(stored)) {
      setPendingAuthReturnUrl(stored);
      return stored;
    }
  } catch {
    /* ignore */
  }

  return null;
}

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

async function readLocalSessionUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
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

  const callbackError = parseOAuthCallbackError(url);
  if (callbackError) {
    if (__DEV__) console.warn('[Agastya auth] OAuth callback error:', callbackError);
    return { ok: false, reason: 'parse_error', message: callbackError };
  }

  if (errorCode) {
    const message =
      errorCode !== 'null' && errorCode !== 'undefined'
        ? `Sign-in was rejected (${errorCode}).`
        : oauthRedirectMisconfigMessage();
    if (__DEV__) console.warn('[Agastya auth] OAuth callback error:', message);
    return { ok: false, reason: 'parse_error', message };
  }

  const code = params.code;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const localUserId = await readLocalSessionUserId();
      if (localUserId) {
        return { ok: true, userId: localUserId };
      }
      const message =
        error.message?.trim() ||
        (error.code === 'bad_code_verifier' || error.code === 'bad_oauth_state'
          ? 'This sign-in must finish on the same device. Try again.'
          : oauthRedirectMisconfigMessage());
      if (__DEV__) console.warn('[Agastya auth] exchangeCodeForSession failed', message, error.code);
      return { ok: false, reason: 'exchange_failed', message };
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
    const localUserId = await readLocalSessionUserId();
    if (localUserId) {
      return { ok: true, recovery: params.type === 'recovery', userId: localUserId };
    }
    if (__DEV__) console.warn('[Agastya auth] setSession failed', error.message);
    return { ok: false, reason: 'exchange_failed', message: error.message };
  }
  const userId = applySessionUser(data.session?.user?.id);
  return { ok: true, recovery: params.type === 'recovery', userId };
}

/** Establish session from redirect URL. Caller handles navigation. */
export async function completeAuthFromUrl(url: string): Promise<AuthUrlResult> {
  const existing = authUrlInFlight.get(url);
  if (existing) return existing;

  const run = (async (): Promise<AuthUrlResult> => {
    if (url.includes('established=1')) {
      const localUserId = await readLocalSessionUserId();
      if (localUserId) {
        return { ok: true, userId: localUserId };
      }
    }

    if (processedAuthUrls.has(url)) {
      const localUserId = await readLocalSessionUserId();
      if (localUserId) {
        return { ok: true, skipped: true, userId: localUserId };
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

    if (__DEV__) {
      console.log('[Agastya auth] session established for', result.userId?.slice(0, 8) ?? 'user');
    }

    consumePendingAuthReturnUrl();

    if (recovery || result.recovery) {
      return { ok: true, recovery: true, userId: result.userId };
    }

    return { ok: true, userId: result.userId };
  })();

  authUrlInFlight.set(url, run);
  try {
    return await run;
  } finally {
    authUrlInFlight.delete(url);
  }
}

/** Wire deep links for OAuth + magic-link / email confirm. */
export function subscribeAuthDeepLinks(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const supabase = getSupabase();
  if (!supabase) return () => {};

  const handle = (url: string | null) => {
    if (!url || !isAuthCallbackUrl(url)) return;
    if (__DEV__) {
      console.log('[Agastya auth] deep link callback:', url.slice(0, 200));
    }

    setPendingAuthReturnUrl(url);
    void dismissOAuthBrowser().catch(() => {});

    if (isRecentAuthEstablished()) {
      void completeAuthFromUrl(url).catch(() => {});
      return;
    }

    router.replace('/auth/callback');
  };

  void Linking.getInitialURL().then((u) => handle(u));
  const sub = Linking.addEventListener('url', ({ url }) => handle(url));
  return () => sub.remove();
}

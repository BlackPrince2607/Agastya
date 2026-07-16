import { Platform } from 'react-native';
import type { Href } from 'expo-router';

import { completeAuthFromUrl, resolveAuthCallbackUrl } from '@/services/authCallback';
import {
  ensureOAuthAuthorizeUrl,
  getAuthRedirectUri,
  resetAuthRedirectUriCache,
} from '@/services/authRedirect';
import { syncAuthUserToStore } from '@/services/authSession';
import { getOAuthBrowserWarning, resetOAuthBrowserCache } from '@/services/oauthBrowser';
import { runOAuthBrowserFlow } from '@/services/oauthSession';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { track } from '@/services/analytics';
import { alertForAuthFailure, parseAuthFailure } from '@/services/authErrorUtils';
import { beginOAuthFlow, endOAuthFlow, markAuthEstablished } from '@/services/authFlow';
import { useSessionStore } from '@/store/sessionStore';
import { resolveAuthenticatedHref } from '@/utils/navigationFlow';
import { deferRouterReplace, resetAppNavigation } from '@/utils/routerDefer';

export type OAuthRunResult =
  | { ok: true; userId?: string | null }
  | { ok: false; cancelled?: boolean; message?: string };

let finishInFlight: Promise<void> | null = null;
let lastNavKey = '';
let lastNavAt = 0;

function navKey(href: Href): string {
  return typeof href === 'string' ? href : JSON.stringify(href);
}

function startBackgroundSync(): void {
  void import('@/services/identity').then(({ bootstrapIdentity }) => {
    void bootstrapIdentity().catch(() => {});
  });
  void import('@/utils/navigationFlow').then(({ ensureCloudStateSynced }) => {
    void ensureCloudStateSynced(true);
  });
  void import('@/services/authMerge').then(({ ensureSessionMerged }) => {
    void ensureSessionMerged().catch(() => {});
  });
}

type NavigateAfterAuthOptions = {
  /** When true, skip kicking off another merge/restore (already awaited before route choice). */
  cloudAlreadySynced?: boolean;
};

/** Single navigation entry after sign-in — deduped. */
export function navigateAfterAuth(
  href: Href,
  userId?: string | null,
  options: NavigateAfterAuthOptions = {},
): void {
  if (userId) {
    syncAuthUserToStore(userId);
  }

  const key = navKey(href);
  if (key === lastNavKey && Date.now() - lastNavAt < 2_500) {
    if (__DEV__) {
      console.log('[Agastya auth] skip duplicate nav →', href);
    }
    return;
  }
  lastNavKey = key;
  lastNavAt = Date.now();
  markAuthEstablished();

  if (useSessionStore.getState().skipCloudRestore) {
    useSessionStore.getState().setSkipCloudRestore(false);
  }
  if (!options.cloudAlreadySynced) {
    startBackgroundSync();
  }

  if (__DEV__) {
    console.log('[Agastya auth] navigate →', href);
  }

  if (href === '/(main)/home') {
    useSessionStore.getState().setEnteredMain(true);
    resetAppNavigation(href);
    return;
  }
  deferRouterReplace(href);
}

/** Establish session, await cloud restore, then route to the correct resume screen. */
export async function completeSignIn(options: { userId?: string | null; recovery?: boolean } = {}): Promise<void> {
  if (finishInFlight) {
    return finishInFlight;
  }

  finishInFlight = (async () => {
    if (options.recovery) {
      navigateAfterAuth('/auth/reset-password', options.userId);
      return;
    }

    const userId = options.userId ?? useSessionStore.getState().supabaseUserId;
    try {
      const supabase = getSupabase();
      const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
      const email = data.user?.email ?? null;
      if (userId || email) {
        syncAuthUserToStore(userId ?? data.user?.id ?? null, email);
      }
    } catch {
      if (userId) syncAuthUserToStore(userId);
    }
    const href = await resolveAuthenticatedHref(userId);
    navigateAfterAuth(href, userId ?? undefined, { cloudAlreadySynced: true });
  })();

  try {
    await finishInFlight;
  } finally {
    finishInFlight = null;
  }
}

/** Google / Apple OAuth — Supabase authorize URL + browser + PKCE exchange. */
export async function runNativeOAuth(provider: 'apple' | 'google'): Promise<OAuthRunResult> {
  const supabase = getSupabase();
  if (!isSupabaseEnabled || !supabase) {
    return { ok: false, message: 'Sign-in is not configured on this build.' };
  }

  if (useSessionStore.getState().skipCloudRestore) {
    useSessionStore.getState().setSkipCloudRestore(false);
  }

  resetAuthRedirectUriCache();
  resetOAuthBrowserCache();

  const redirectUri = getAuthRedirectUri();
  beginOAuthFlow();

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (error) {
      const alert = alertForAuthFailure(parseAuthFailure(error));
      return { ok: false, message: alert.body };
    }

    if (Platform.OS === 'web') {
      if (data.url) {
        window.location.assign(data.url);
      }
      return { ok: false, message: 'Could not open the sign-in page.' };
    }

    if (!data.url) {
      return { ok: false, message: `Could not start ${provider} sign-in.` };
    }

    const browserWarning = await getOAuthBrowserWarning();
    if (browserWarning && __DEV__) {
      console.warn('[Agastya auth]', browserWarning);
    }

    const authorizeUrl = ensureOAuthAuthorizeUrl(data.url, redirectUri);
    const flow = await runOAuthBrowserFlow(authorizeUrl, redirectUri);

    if (!flow.ok) {
      return {
        ok: false,
        cancelled: flow.cancelled,
        message: flow.message ?? 'Sign-in was cancelled.',
      };
    }

    if (__DEV__) {
      console.log('[Agastya auth] exchanging OAuth code…');
    }

    const authResult = await completeAuthFromUrl(flow.url);
    if (!authResult.ok) {
      return {
        ok: false,
        message: authResult.message ?? 'Could not verify your sign-in. Try again.',
      };
    }

    track('auth_oauth_attempt', { provider });
    await completeSignIn({ userId: authResult.userId, recovery: authResult.recovery });
    return { ok: true, userId: authResult.userId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed.';
    if (__DEV__) console.warn('[Agastya auth] OAuth failed', err);
    return { ok: false, message };
  } finally {
    endOAuthFlow();
  }
}

/** Magic-link / email callback screen (not used for inline Google OAuth). */
export async function processAuthCallbackScreen(): Promise<Href | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = window.location.href;
      const result = await completeAuthFromUrl(url);
      window.history.replaceState({}, document.title, '/auth/callback');
      if (!result.ok) {
        return '/onboarding/account';
      }
      if (result.recovery) {
        navigateAfterAuth('/auth/reset-password', result.userId);
        return null;
      }
      await completeSignIn({ userId: result.userId });
      return null;
    }

    const callbackUrl = await resolveAuthCallbackUrl();
    if (callbackUrl) {
      if (__DEV__) {
        console.log('[Agastya auth] callback screen processing URL');
      }
      const result = await completeAuthFromUrl(callbackUrl);
      if (result.ok) {
        if (result.recovery) {
          navigateAfterAuth('/auth/reset-password', result.userId);
          return null;
        }
        await completeSignIn({ userId: result.userId });
        return null;
      }
      if (__DEV__) {
        console.warn('[Agastya auth] callback screen exchange failed', result.message);
      }
    }

    return '/onboarding/account';
  } catch (err) {
    if (__DEV__) console.warn('[Agastya auth] callback screen failed', err);
    return '/onboarding/account';
  }
}

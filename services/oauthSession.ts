import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import {
  peekPendingAuthReturnUrl,
  resolveAuthCallbackUrl,
  setPendingAuthReturnUrl,
} from '@/services/authCallback';
import {
  isAuthCallbackUrl,
  isOAuthSuccessCallback,
  parseOAuthCallbackError,
} from '@/services/authRedirect';
import { openOAuthBrowserSession } from '@/services/oauthBrowser';
import { getSupabase } from '@/services/supabase';

export type OAuthBrowserOutcome =
  | { ok: true; url: string }
  | { ok: false; cancelled?: boolean; message?: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** After Custom Tabs closes, Expo Go may deliver the callback via exp:// a moment later. */
async function waitForPendingAuthUrl(timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
    const resolved = await resolveAuthCallbackUrl();
    if (resolved && isAuthCallbackUrl(resolved)) {
      return resolved;
    }
    await sleep(120);
  }
  return null;
}

/**
 * Open Google/Apple OAuth in Custom Tabs and return the Supabase callback URL.
 */
export async function runOAuthBrowserFlow(
  oauthUrl: string,
  redirectUri: string,
): Promise<OAuthBrowserOutcome> {
  if (__DEV__) {
    console.log('[Agastya auth] opening OAuth → redirect', redirectUri);
  }

  // Helps Expo Go finish the auth session when the app reloads on exp:// return.
  WebBrowser.maybeCompleteAuthSession();

  const result = await openOAuthBrowserSession(oauthUrl, redirectUri);

  if (__DEV__) {
    console.log(
      '[Agastya auth] browser closed:',
      result.type,
      result.type === 'success' ? result.url?.slice(0, 140) : '',
    );
  }

  if (result.type === 'success' && result.url) {
    const oauthError = parseOAuthCallbackError(result.url);
    if (oauthError) {
      return { ok: false, message: oauthError };
    }
    if (isOAuthSuccessCallback(result.url) || isAuthCallbackUrl(result.url)) {
      return { ok: true, url: result.url };
    }
  }

  const pending = await waitForPendingAuthUrl(result.type === 'success' ? 1_200 : 5_500);
  if (pending) {
    if (__DEV__) {
      console.log('[Agastya auth] using pending deep-link callback');
    }
    const oauthError = parseOAuthCallbackError(pending);
    if (oauthError) {
      return { ok: false, message: oauthError };
    }
    return { ok: true, url: pending };
  }

  if (__DEV__ && (result.type === 'cancel' || result.type === 'dismiss')) {
    console.warn(
      '[Agastya auth] no deep link after browser',
      result.type,
      '— confirm Supabase Redirect URLs include exp://** and',
      redirectUri,
    );
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId) {
      return { ok: true, url: `${redirectUri}?established=1` };
    }
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, cancelled: true };
  }

  return {
    ok: false,
    message:
      'Google sign-in did not finish. In Supabase → Authentication → URL Configuration, add redirect URL exp://** (and your exact exp callback from the Metro log).',
  };
}

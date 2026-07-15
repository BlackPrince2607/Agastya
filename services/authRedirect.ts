import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

let cachedRedirectUri: string | null = null;

/** Call before OAuth if Metro restarted and the LAN IP may have changed (Expo Go). */
export function resetAuthRedirectUriCache(): void {
  cachedRedirectUri = null;
}

/** Legacy Metro static page — redirects to exp:// if an old redirect URL is still allowlisted. */
export const EXPO_GO_OAUTH_CALLBACK_PATH = '/auth-callback.html';

/**
 * Redirect URI registered with Supabase Auth (OAuth + magic link + email confirm).
 *
 * - Web: `{origin}/auth/callback`
 * - Expo Go (native): `exp://<metro-host>/--/auth/callback` — Custom Tabs hand off to the app
 *   (http:// Metro callbacks stay open in the browser and never return to JS).
 * - Dev/prod builds: `agastya://auth/callback`
 *
 * Supabase → Authentication → URL Configuration → Redirect URLs must include:
 * `exp://**`, `agastya://**` (optional legacy: `http://**` for auth-callback.html)
 */
export function getAuthRedirectUri(): string {
  if (cachedRedirectUri) return cachedRedirectUri;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    cachedRedirectUri = `${window.location.origin}/auth/callback`;
  } else if (Constants.appOwnership === 'expo') {
    cachedRedirectUri = Linking.createURL('/auth/callback');
    if (!cachedRedirectUri || cachedRedirectUri.includes('localhost')) {
      cachedRedirectUri = makeRedirectUri({
        path: 'auth/callback',
        preferLocalhost: false,
      });
    }
  } else {
    const scheme = Constants.expoConfig?.scheme;
    cachedRedirectUri = makeRedirectUri({
      scheme: Array.isArray(scheme) ? scheme[0] ?? 'agastya' : scheme ?? 'agastya',
      path: 'auth/callback',
    });
  }

  if (__DEV__) {
    console.log('[Agastya auth] redirect URI:', cachedRedirectUri);
  }

  return cachedRedirectUri;
}

function parseCallbackQuery(url: string): { params: Record<string, string>; errorCode?: string } {
  const { params, errorCode: rawCode } = QueryParams.getQueryParams(url);
  const errorCode = rawCode ?? undefined;
  if (params.code || params.access_token || params.error || params.error_description) {
    return { params, errorCode };
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const fromHash = QueryParams.getQueryParams(`?${url.slice(hashIndex + 1)}`);
    if (fromHash.params.code || fromHash.params.access_token || fromHash.params.error) {
      return { params: fromHash.params, errorCode: fromHash.errorCode ?? undefined };
    }
  }

  return { params, errorCode };
}

function hasAuthCallbackPayload(url: string): boolean {
  return /(?:^|[?&#])(?:code|access_token|error_description|error)=/i.test(url);
}

/** True when a deep link / browser return carries Supabase auth params. */
export function isAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  if (/auth-callback\.html/i.test(url) && hasAuthCallbackPayload(url)) return true;
  return hasAuthCallbackPayload(url);
}

/** OAuth succeeded — URL carries a session code or tokens (not an error redirect). */
export function isOAuthSuccessCallback(url: string): boolean {
  if (!url) return false;
  const { params } = parseCallbackQuery(url);
  return Boolean(params.code || params.access_token);
}

/** Supabase OAuth error redirect (e.g. redirect URI not allowlisted → error=null). */
export function parseOAuthCallbackError(url: string): string | null {
  if (!isAuthCallbackUrl(url) || isOAuthSuccessCallback(url)) return null;

  const { params, errorCode } = parseCallbackQuery(url);
  const oauthError = params.error_description ?? params.error;
  const normalized =
    oauthError && oauthError !== 'null' && oauthError !== 'undefined' ? oauthError : undefined;

  if (normalized) return normalized;
  if (errorCode && errorCode !== 'null' && errorCode !== 'undefined') {
    return `Sign-in was rejected (${errorCode}).`;
  }
  return oauthRedirectMisconfigMessage();
}

/** Ensure redirect_to is set on the Supabase authorize URL (never null / localhost for mobile). */
export function ensureOAuthAuthorizeUrl(authorizeUrl: string, redirectTo: string): string {
  try {
    const url = new URL(authorizeUrl);
    const current = url.searchParams.get('redirect_to');
    const needsPatch =
      !current ||
      current === 'null' ||
      current === 'undefined' ||
      current !== redirectTo;

    if (needsPatch) {
      url.searchParams.set('redirect_to', redirectTo);
      if (__DEV__) {
        console.warn('[Agastya auth] patched authorize redirect_to →', redirectTo);
      }
    }
    return url.toString();
  } catch {
    return authorizeUrl;
  }
}

/** User-facing hint when Supabase rejects the redirect URI. */
export function oauthRedirectMisconfigMessage(): string {
  const uri = getAuthRedirectUri();
  if (Constants.appOwnership === 'expo') {
    return (
      'Google sign-in could not return to the app. In Supabase → Authentication → URL Configuration:\n\n' +
      '   Redirect URLs: exp://** , agastya://**\n\n' +
      `   Add this exact callback: ${uri}`
    );
  }
  return `Add agastya://** and this URI in Supabase redirect URLs:\n${uri}`;
}

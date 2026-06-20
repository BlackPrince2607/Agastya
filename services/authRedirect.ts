import { makeRedirectUri } from 'expo-auth-session';

/**
 * Redirect URI registered with Supabase Auth (OAuth + magic link).
 * Uses expo-auth-session so Expo Go (exp://) and standalone (agastya://) both work.
 */
export function getAuthRedirectUri(): string {
  const uri = makeRedirectUri({
    scheme: 'agastya',
    path: 'auth/callback',
  });
  if (__DEV__) {
    console.log('[Agastya auth] redirect URI — add to Supabase Auth → Redirect URLs:', uri);
  }
  return uri;
}

/** True when a deep link / browser return carries Supabase auth params. */
export function isAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  if (/auth\/callback/i.test(url)) return true;
  return /(?:^|[?&#])(?:code|access_token|error_description)=/i.test(url);
}

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

let cachedRedirectUri: string | null = null;

/**
 * Redirect URI registered with Supabase Auth (OAuth + magic link + email confirm).
 *
 * - Web: `{origin}/auth/callback`
 * - Expo Go: `exp://<lan>:8081/--/auth/callback` (add `exp://**` in Supabase)
 * - Dev/prod builds: `agastya://auth/callback` (add `agastya://**` in Supabase)
 */
export function getAuthRedirectUri(): string {
  if (cachedRedirectUri) return cachedRedirectUri;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    cachedRedirectUri = `${window.location.origin}/auth/callback`;
  } else {
    // Linking.createURL picks exp:// in Expo Go and agastya:// in standalone builds.
    cachedRedirectUri = Linking.createURL('/auth/callback');
  }

  if (__DEV__) {
    console.log('[Agastya auth] redirect URI:', cachedRedirectUri);
  }

  return cachedRedirectUri;
}

/** True when a deep link / browser return carries Supabase auth params. */
export function isAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  if (/auth\/callback/i.test(url)) return true;
  return /(?:^|[?&#])(?:code|access_token|error_description)=/i.test(url);
}

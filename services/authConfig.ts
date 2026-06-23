import Constants from 'expo-constants';

import { isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';

function readExtraFlag(key: 'bypassAuth' | 'allowDevPremium'): boolean | undefined {
  const raw = Constants.expoConfig?.extra?.[key];
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return undefined;
}

/** Magic-link OTP when Supabase is configured (set EXPO_PUBLIC_EMAIL_SIGNIN=false to hide). */
export const isMagicLinkEnabled =
  isSupabaseEnabled && process.env.EXPO_PUBLIC_EMAIL_SIGNIN !== 'false';

/** Email + password whenever the Supabase client is configured. */
export const isPasswordAuthEnabled = isSupabaseEnabled;

/** Show the email sign-in block (password by default; magic link when not disabled). */
export const isEmailAuthEnabled = isPasswordAuthEnabled;

/** Google / Apple OAuth when Supabase is configured (set EXPO_PUBLIC_OAUTH_SIGNIN=false to hide). */
export const isOAuthSignInEnabled =
  isSupabaseEnabled && process.env.EXPO_PUBLIC_OAUTH_SIGNIN !== 'false';

/**
 * Skip Supabase sign-in requirement for main app.
 * Off by default — set EXPO_PUBLIC_BYPASS_AUTH=true or app.config extra.bypassAuth to enable.
 */
export const isAuthBypassEnabled = (() => {
  const fromExtra = readExtraFlag('bypassAuth');
  if (fromExtra === true) return true;
  if (fromExtra === false) return false;
  if (process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true') return true;
  return false;
})();

export function requiresSupabaseSignIn(): boolean {
  return isSupabaseEnabled && !isAuthBypassEnabled;
}

/** Apply dev-only premium unlock from env (called once at startup). */
export function applyDevAccessGrants(): void {
  if (!__DEV__) return;
  const allowPremium =
    readExtraFlag('allowDevPremium') === true ||
    process.env.EXPO_PUBLIC_ALLOW_DEV_PREMIUM === 'true';
  if (!allowPremium) return;
  if (!useSessionStore.getState().hasUnlockedPremium) {
    useSessionStore.getState().setPremium(true);
  }
}

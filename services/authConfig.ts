import Constants from 'expo-constants';

import { isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';

function readExtraFlag(key: 'bypassAuth' | 'allowDevPremium'): boolean | undefined {
  const raw = Constants.expoConfig?.extra?.[key];
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return undefined;
}

/** Email magic-link sign-in (Supabase OTP). Off by default — enable after custom SMTP / higher limits. */
export const isEmailSignInEnabled = process.env.EXPO_PUBLIC_EMAIL_SIGNIN === 'true';

/**
 * Skip Supabase sign-in requirement for main app.
 * On in dev when EXPO_PUBLIC_BYPASS_AUTH=true (also mirrored in app.config.js extra).
 */
export const isAuthBypassEnabled = (() => {
  const fromExtra = readExtraFlag('bypassAuth');
  if (fromExtra === true) return true;
  if (fromExtra === false) return false;
  if (process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true') return true;
  if (process.env.EXPO_PUBLIC_BYPASS_AUTH === 'false') return false;
  return __DEV__;
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

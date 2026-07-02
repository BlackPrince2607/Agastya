import { isSupabaseEnabled } from '@/services/supabase';

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

export function requiresSupabaseSignIn(): boolean {
  return isSupabaseEnabled;
}

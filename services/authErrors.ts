/** Map Supabase Auth API errors to user-friendly copy. */
import { EMAIL_SIGNIN_USE_OAUTH } from '@/constants/userCopy';

export function mapSupabaseAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Enter a valid email address.';
  }

  if (
    m.includes('rate') ||
    m.includes('exceeded') ||
    m.includes('too many') ||
    m.includes('once every')
  ) {
    return EMAIL_SIGNIN_USE_OAUTH;
  }

  if (m.includes('signup') && m.includes('disabled')) {
    return 'Email sign-up is disabled in Supabase. Try Google or Apple, or enable Email provider.';
  }

  if (m.includes('redirect') || m.includes('redirect_uri') || m.includes('redirect url')) {
    return 'Sign-in redirect is not allowed. Add this app’s redirect URL in Supabase → Auth → URL configuration.';
  }

  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'That sign-in provider is not enabled in Supabase yet.';
  }

  if (m.includes('invalid api key') || m.includes('invalid jwt')) {
    return 'Supabase keys look wrong. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  }

  return message;
}

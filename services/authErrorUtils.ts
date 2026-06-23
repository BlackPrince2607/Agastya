import type { AuthError } from '@supabase/supabase-js';

import { mapSupabaseAuthError } from '@/services/authErrors';

export type AuthFailureReason =
  | 'invalid_credentials'
  | 'user_exists'
  | 'redirect'
  | 'rate_limit'
  | 'email_invalid'
  | 'weak_password'
  | 'provider_disabled'
  | 'network'
  | 'pkce'
  | 'unknown';

export type ParsedAuthFailure = {
  message: string;
  reason: AuthFailureReason;
  code?: string;
  status?: number;
};

function reasonFromCode(code: string | undefined): AuthFailureReason | null {
  switch (code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_exists':
    case 'user_already_exists':
      return 'user_exists';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate_limit';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'email_invalid';
    case 'weak_password':
      return 'weak_password';
    case 'email_provider_disabled':
    case 'signup_disabled':
    case 'provider_disabled':
      return 'provider_disabled';
    case 'bad_code_verifier':
    case 'bad_oauth_state':
    case 'bad_oauth_callback':
      return 'pkce';
    default:
      return null;
  }
}

function reasonFromMessage(message: string): AuthFailureReason {
  const m = message.toLowerCase();
  if (m.includes('network request failed') || m.includes('failed to fetch')) return 'network';
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'invalid_credentials';
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('email_exists')) {
    return 'user_exists';
  }
  if (m.includes('redirect')) return 'redirect';
  if (m.includes('rate') || m.includes('too many') || m.includes('once every')) return 'rate_limit';
  if (m.includes('invalid email') || m.includes('email_address_invalid')) return 'email_invalid';
  if (m.includes('weak password') || m.includes('weak_password')) return 'weak_password';
  if (m.includes('provider') && m.includes('disabled')) return 'provider_disabled';
  if (m.includes('bad_code_verifier') || m.includes('code verifier')) return 'pkce';
  return 'unknown';
}

export function parseAuthFailure(error: AuthError | Error | string | null | undefined): ParsedAuthFailure {
  if (!error) {
    return { message: 'Sign-in failed with no error details.', reason: 'unknown' };
  }

  if (typeof error === 'string') {
    const message = error.trim() || 'Sign-in failed.';
    return { message, reason: reasonFromMessage(message) };
  }

  const authError = error as AuthError;
  const code = authError.code;
  const status = authError.status;
  const message =
    authError.message?.trim() ||
    (code ? `Supabase auth error (${code})` : '') ||
    (status ? `Supabase auth HTTP ${status}` : '') ||
    error.name ||
    'Sign-in failed.';

  return {
    message,
    code,
    status,
    reason: reasonFromCode(code) ?? reasonFromMessage(message),
  };
}

export function userMessageForAuthFailure(failure: ParsedAuthFailure): string {
  if (failure.reason === 'rate_limit') {
    return 'Too many sign-in emails were sent from this project. Wait about an hour, or configure custom SMTP in Supabase → Project Settings → Auth.';
  }
  if (failure.reason === 'user_exists') {
    return 'An account already exists for this email. Sign in instead, or use Forgot password.';
  }
  if (failure.reason === 'pkce') {
    return 'This sign-in link must be opened on the same phone where you requested it. Force-close the app, reopen it, and try again — or sign in with your password after confirming your email.';
  }
  const mapped = mapSupabaseAuthError(failure.message);
  if (
    mapped === 'Something went wrong. Please try again.' &&
    (failure.code || failure.status)
  ) {
    const detail = [failure.code, failure.status ? `HTTP ${failure.status}` : ''].filter(Boolean).join(' · ');
    return `${mapped} (${detail})`;
  }
  return mapped;
}

export function alertForAuthFailure(failure: ParsedAuthFailure): { title: string; body: string } {
  const friendly = userMessageForAuthFailure(failure);
  const technical = [failure.code, failure.status ? `HTTP ${failure.status}` : '', failure.message]
    .filter(Boolean)
    .join(' · ');
  return {
    title: 'Sign-in failed',
    body: technical && friendly !== failure.message ? `${friendly}\n\n${technical}` : friendly,
  };
}

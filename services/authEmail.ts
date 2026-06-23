import {
  parseAuthFailure,
  type AuthFailureReason,
  userMessageForAuthFailure,
} from '@/services/authErrorUtils';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { apiUrl, isApiConfigured } from '@/services/env';
import { SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';

export type AuthEmailResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | {
      ok: false;
      message: string;
      reason?: AuthFailureReason;
      code?: string;
    };

function unavailable(): AuthEmailResult {
  return { ok: false, message: SIGN_IN_UNAVAILABLE, reason: 'unknown' };
}

function failFrom(error: unknown): AuthEmailResult {
  const parsed = parseAuthFailure(error instanceof Error ? error : String(error));
  return {
    ok: false,
    message: userMessageForAuthFailure(parsed),
    reason: parsed.reason,
    code: parsed.code,
  };
}

export type EmailAccountProbe = { exists: boolean; checked: boolean };

/** Ask backend whether this email is already registered (service role). */
export async function probeEmailAccount(email: string): Promise<EmailAccountProbe> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    return { exists: false, checked: true };
  }

  if (!isApiConfigured()) {
    return { exists: false, checked: false };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(apiUrl('/v1/auth/check-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: trimmed }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { exists: false, checked: false };
    }
    const data = (await res.json()) as { exists?: boolean; checked?: boolean };
    return {
      exists: Boolean(data.exists),
      checked: data.checked !== false,
    };
  } catch {
    return { exists: false, checked: false };
  }
}

export async function sendMagicLink(email: string, redirectUri: string): Promise<AuthEmailResult> {
  const supabase = getSupabase();
  if (!isSupabaseEnabled || !supabase) return unavailable();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    return { ok: false, message: 'Enter a valid email address.', reason: 'email_invalid' };
  }

  if (__DEV__) {
    console.log('[Agastya auth] magic link redirect:', redirectUri);
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectUri,
        shouldCreateUser: true,
      },
    });
    if (error) {
      if (__DEV__) console.warn('[Agastya auth] signInWithOtp failed:', error);
      return failFrom(error);
    }
    return { ok: true };
  } catch (err) {
    if (__DEV__) console.warn('[Agastya auth] signInWithOtp threw:', err);
    return failFrom(err);
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthEmailResult> {
  const supabase = getSupabase();
  if (!isSupabaseEnabled || !supabase) return unavailable();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    return { ok: false, message: 'Enter a valid email address.', reason: 'email_invalid' };
  }
  if (!password) {
    return { ok: false, message: 'Enter your password.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      if (__DEV__) console.warn('[Agastya auth] signInWithPassword failed:', error);
      return failFrom(error);
    }
    if (!data.session) {
      return { ok: false, message: 'Check your inbox to confirm your email first.' };
    }
    return { ok: true };
  } catch (err) {
    if (__DEV__) console.warn('[Agastya auth] signInWithPassword threw:', err);
    return failFrom(err);
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  redirectUri: string,
): Promise<AuthEmailResult> {
  const supabase = getSupabase();
  if (!isSupabaseEnabled || !supabase) return unavailable();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    return { ok: false, message: 'Enter a valid email address.', reason: 'email_invalid' };
  }
  if (!password) {
    return { ok: false, message: 'Choose a password.' };
  }

  try {
    // Password sign-up: only attach redirect when we have one (confirmation email link).
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: redirectUri ? { emailRedirectTo: redirectUri } : undefined,
    });

    if (__DEV__) {
      console.log('[Agastya auth] signUp response:', {
        userId: data.user?.id,
        identities: data.user?.identities?.length ?? 0,
        session: Boolean(data.session),
        error: error
          ? {
              message: error.message,
              code: (error as { code?: string }).code,
              status: error.status,
            }
          : null,
      });
    }

    // User created without a session → confirmation email was sent (even if GoTrue also returned a soft error).
    if (data.user && !data.session) {
      return { ok: true, needsEmailConfirmation: true };
    }

    if (error) {
      const parsed = parseAuthFailure(error);
      // Account already exists — Supabase may still resend the confirmation email.
      if (parsed.reason === 'user_exists') {
        return { ok: true, needsEmailConfirmation: true };
      }
      if (__DEV__) console.warn('[Agastya auth] signUp failed:', error);
      return failFrom(error);
    }

    if (!data.user) {
      return { ok: false, message: 'Sign-up failed. Please try again.', reason: 'unknown' };
    }

    return { ok: true };
  } catch (err) {
    if (__DEV__) console.warn('[Agastya auth] signUp threw:', err);
    return failFrom(err);
  }
}

export async function sendPasswordReset(
  email: string,
  redirectUri: string,
): Promise<AuthEmailResult> {
  const supabase = getSupabase();
  if (!isSupabaseEnabled || !supabase) return unavailable();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    return { ok: false, message: 'Enter a valid email address.', reason: 'email_invalid' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: redirectUri,
    });
    if (error) return failFrom(error);
    return { ok: true };
  } catch (err) {
    return failFrom(err);
  }
}

export async function updatePassword(newPassword: string): Promise<AuthEmailResult> {
  const supabase = getSupabase();
  if (!isSupabaseEnabled || !supabase) return unavailable();

  if (newPassword.length < 6) {
    return { ok: false, message: 'Password must be at least 6 characters.' };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return failFrom(error);
    return { ok: true };
  } catch (err) {
    return failFrom(err);
  }
}

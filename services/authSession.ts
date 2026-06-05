import { router } from 'expo-router';

import { track } from '@/services/analytics';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';

export type AuthSessionSnapshot = {
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
};

export async function readAuthSession(): Promise<AuthSessionSnapshot> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseEnabled) {
    return { isSignedIn: false, userId: null, email: null };
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return {
    isSignedIn: Boolean(user?.id),
    userId: user?.id ?? null,
    email: user?.email ?? null,
  };
}

export function syncAuthUserToStore(userId: string | null) {
  useSessionStore.setState({ supabaseUserId: userId });
}

/** Leave main app and return to welcome — keeps local reading; use after sign-out. */
export function leaveMainAppForOnboarding() {
  useSessionStore.getState().setEnteredMain(false);
}

export async function signOutAndReturnToWelcome(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      /* still clear local session */
    }
  }
  syncAuthUserToStore(null);
  leaveMainAppForOnboarding();
  track('auth_signed_out');
  router.replace('/welcome');
}

export async function signInFromProfile(): Promise<void> {
  router.push('/onboarding/account');
}

/** Wipe local progress and Supabase session, land on welcome. */
export async function resetLocalAndSignOut(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
  useSessionStore.getState().resetDemo();
  track('local_reset');
  router.replace('/welcome');
}

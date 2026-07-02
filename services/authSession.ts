import type { Href } from 'expo-router';
import { router } from 'expo-router';

import { track } from '@/services/analytics';
import { deleteAccountFromServer } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { bootstrapIdentity } from '@/services/identity';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import { resetAppNavigation } from '@/utils/routerDefer';

export type AuthSessionSnapshot = {
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
};

const EMPTY: AuthSessionSnapshot = { isSignedIn: false, userId: null, email: null };

let postSignInReturnHref: Href | null = null;

function snapshotFromSession(session: { user?: { id?: string; email?: string | null } | null } | null): AuthSessionSnapshot {
  const user = session?.user;
  return {
    isSignedIn: Boolean(user?.id),
    userId: user?.id ?? null,
    email: user?.email ?? null,
  };
}

/** Read session via INITIAL_SESSION (avoids hanging getSession during AsyncStorage hydration). */
export function readAuthSession(): Promise<AuthSessionSnapshot> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseEnabled) {
    return Promise.resolve(EMPTY);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (snap: AuthSessionSnapshot) => {
      if (settled) return;
      settled = true;
      sub.subscription.unsubscribe();
      resolve(snap);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED'
      ) {
        finish(snapshotFromSession(session));
      }
    });
  });
}

/** Non-blocking auth probe for cold start — uses onAuthStateChange, never getSession(). */
export function probeAuthSessionInBackground(
  onReady: (snap: AuthSessionSnapshot) => void,
): void {
  void readAuthSession().then(onReady);
}

/** After the next successful sign-in, navigate here instead of the default onboarding route. */
export function setPostSignInReturn(href: Href | null): void {
  postSignInReturnHref = href;
}

export function consumePostSignInReturn(): Href | null {
  const href = postSignInReturnHref;
  postSignInReturnHref = null;
  return href;
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
  useSessionStore.getState().setSyncNotice(null);
  leaveMainAppForOnboarding();
  track('auth_signed_out');
  resetAppNavigation('/welcome');
}

export async function signInFromProfile(): Promise<void> {
  setPostSignInReturn('/(main)/profile');
  router.push({ pathname: '/onboarding/account', params: { fromProfile: '1' } });
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
  useChatStore.getState().clear();
  track('local_reset');
  await bootstrapIdentity();
  resetAppNavigation('/welcome');
}

/** Permanently delete the signed-in account, cloud data, and local state. */
export async function deleteAccountAndReset(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseEnabled) {
    throw new Error('Account deletion requires sign-in to be configured.');
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session?.user?.id) {
    throw new Error('You must be signed in to delete your account.');
  }

  if (isApiConfigured()) {
    await deleteAccountFromServer();
  }

  try {
    await supabase.auth.signOut();
  } catch {
    /* local wipe still proceeds */
  }

  syncAuthUserToStore(null);
  useSessionStore.getState().resetDemo();
  useChatStore.getState().clear();
  track('account_deleted');
  await bootstrapIdentity();
  resetAppNavigation('/welcome');
}

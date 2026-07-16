import { mergeSessions } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { syncAuthUserToStore } from '@/services/authSession';
import { ensureDeviceIdentity, syncProfileRemote } from '@/services/identity';
import { linkRevenueCatUser } from '@/services/revenuecat';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { getSupabase, waitForSupabaseAccessToken } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { isApiConfigured } from '@/services/env';

let mergeInFlight: Promise<void> | null = null;

async function tryMergeSession(supabaseUserId: string) {
  const anonymousSessionId = useSessionStore.getState().sessionId;
  if (!anonymousSessionId) return;

  if (mergeInFlight) {
    return mergeInFlight;
  }

  mergeInFlight = (async () => {
    if (!isApiConfigured()) return;

    // Wait for Supabase session storage to settle after OAuth / magic-link exchange
    // so `/v1/sessions/merge` receives a valid Authorization bearer token.
    const token = await waitForSupabaseAccessToken();
    if (!token) {
      if (__DEV__) {
        console.warn('[Agastya] session merge skipped — no access token on Supabase session');
      }
      return;
    }

    try {
      await ensureDeviceIdentity();
      await syncProfileRemote().catch(() => {});
      const deviceInstallId = useSessionStore.getState().deviceInstallId;
      if (!deviceInstallId) {
        throw new Error('deviceInstallId required for session merge');
      }
      const res = await mergeSessions({
        anonymousSessionId,
        supabaseUserId,
        deviceInstallId,
      });
      syncAuthUserToStore(supabaseUserId);
      track('session_merge', { linked: res.linked });
      await linkRevenueCatUser(supabaseUserId);
      // Always force restore after a successful merge — the user's explicit sign-in intent
      // overrides any prior local `skipCloudRestore` flag from "Start fresh" / "Replay setup".
      await restoreSessionFromServer({ force: true });
      useSessionStore.getState().setSyncNotice(null);
    } catch (err) {
      track('session_merge_failed');
      useSessionStore
        .getState()
        .setSyncNotice('Sign-in succeeded but cloud sync failed. Pull to refresh or try again shortly.');
      if (__DEV__) {
        console.warn(
          '[Agastya] session merge failed — ensure backend SUPABASE_URL is set and JWT verification can reach JWKS.',
          err,
        );
      }
    }
  })();

  try {
    await mergeInFlight;
  } finally {
    mergeInFlight = null;
  }
}

/** Run merge for the current Supabase user if needed (after OAuth / magic link). */
export async function ensureSessionMerged(): Promise<void> {
  const storedUserId = useSessionStore.getState().supabaseUserId;
  if (storedUserId) {
    await tryMergeSession(storedUserId);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return;
  syncAuthUserToStore(userId);
  await tryMergeSession(userId);
}

/** Links anonymous FastAPI session to Supabase user; clears store on sign-out. */
export function subscribeSupabaseSessionMerge(): () => void {
  const supabase = getSupabase();
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      syncAuthUserToStore(null);
      return;
    }

    const userId = session?.user?.id;
    if (!userId) return;

    syncAuthUserToStore(userId);

    if (event === 'SIGNED_IN') {
      void tryMergeSession(userId);
      return;
    }

    if (event === 'INITIAL_SESSION') {
      setTimeout(() => void tryMergeSession(userId), 3_000);
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

import { mergeSessions } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { syncAuthUserToStore } from '@/services/authSession';
import { syncProfileRemote } from '@/services/identity';
import { linkRevenueCatUser } from '@/services/revenuecat';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { getSupabase, getSupabaseAccessToken } from '@/services/supabase';
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

    const token = await getSupabaseAccessToken();
    if (!token) {
      if (__DEV__) {
        console.warn('[Agastya] session merge skipped — no access token on Supabase session');
      }
      return;
    }

    try {
      await syncProfileRemote();
      const res = await mergeSessions({
        anonymousSessionId,
        supabaseUserId,
        deviceInstallId: useSessionStore.getState().deviceInstallId ?? undefined,
      });
      syncAuthUserToStore(supabaseUserId);
      track('session_merge', { linked: res.linked });
      await linkRevenueCatUser(supabaseUserId);
      if (!useSessionStore.getState().skipCloudRestore) {
        await restoreSessionFromServer({ force: true });
      }
      useSessionStore.getState().setSyncNotice(null);
    } catch (err) {
      track('session_merge_failed');
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

    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      void tryMergeSession(userId);
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

import { mergeSessions } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { syncAuthUserToStore } from '@/services/authSession';
import { linkRevenueCatUser } from '@/services/revenuecat';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { getSupabase, waitForSupabaseAccessToken } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { SYNC_NOTICE_MERGE_FAILED } from '@/constants/userCopy';

async function tryMergeSession(supabaseUserId: string) {
  const anonymousSessionId = useSessionStore.getState().sessionId;
  if (!anonymousSessionId) return;

  await waitForSupabaseAccessToken();

  try {
    const res = await mergeSessions({
      anonymousSessionId,
      supabaseUserId,
    });
    syncAuthUserToStore(supabaseUserId);
    track('session_merge', { linked: res.linked });
    await linkRevenueCatUser(supabaseUserId);
    await restoreSessionFromServer({ force: true });
    useSessionStore.getState().setSyncNotice(null);
  } catch (err) {
    track('session_merge_failed');
    useSessionStore.getState().setSyncNotice(SYNC_NOTICE_MERGE_FAILED);
    if (__DEV__) {
      console.warn('[Agastya] session merge failed', err);
    }
  }
}

/** Run merge for the current Supabase user if needed (after OAuth / magic link). */
export async function ensureSessionMerged(): Promise<void> {
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
      await tryMergeSession(userId);
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

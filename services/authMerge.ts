import { mergeSessions } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { syncAuthUserToStore } from '@/services/authSession';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { getSupabase } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';

async function tryMergeSession(supabaseUserId: string) {
  const state = useSessionStore.getState();
  if (state.supabaseUserId === supabaseUserId) return;
  const anonymousSessionId = state.sessionId;
  if (!anonymousSessionId) return;

  try {
    const res = await mergeSessions({
      anonymousSessionId,
      supabaseUserId,
    });
    syncAuthUserToStore(supabaseUserId);
    track('session_merge', { linked: res.linked });
    await restoreSessionFromServer({ force: true });
  } catch {
    track('session_merge_failed');
    if (__DEV__) {
      console.warn('[Agastya] session merge failed — check SUPABASE_JWT_SECRET on API');
    }
  }
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

    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      await tryMergeSession(userId);
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

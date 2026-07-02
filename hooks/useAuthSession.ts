import { useEffect, useState } from 'react';

import { syncAuthUserToStore, type AuthSessionSnapshot } from '@/services/authSession';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';

const EMPTY: AuthSessionSnapshot = { isSignedIn: false, userId: null, email: null };

/** Live Supabase session for Profile and account screens. */
export function useAuthSession(): AuthSessionSnapshot & { loading: boolean } {
  const [snap, setSnap] = useState<AuthSessionSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const supabase = getSupabase();
    if (!supabase || !isSupabaseEnabled) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const user = session?.user;
      const next: AuthSessionSnapshot = {
        isSignedIn: Boolean(user?.id),
        userId: user?.id ?? null,
        email: user?.email ?? null,
      };
      setSnap(next);
      syncAuthUserToStore(next.userId);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { ...snap, loading };
}

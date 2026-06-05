import { useEffect, useState } from 'react';

import { readAuthSession, syncAuthUserToStore, type AuthSessionSnapshot } from '@/services/authSession';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';

const EMPTY: AuthSessionSnapshot = { isSignedIn: false, userId: null, email: null };

/** Live Supabase session for Profile and account screens. */
export function useAuthSession(): AuthSessionSnapshot & { loading: boolean } {
  const [snap, setSnap] = useState<AuthSessionSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const next = await readAuthSession();
      if (!active) return;
      setSnap(next);
      syncAuthUserToStore(next.userId);
      setLoading(false);
    };

    void refresh();

    const supabase = getSupabase();
    if (!supabase || !isSupabaseEnabled) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      const next: AuthSessionSnapshot = {
        isSignedIn: Boolean(user?.id),
        userId: user?.id ?? null,
        email: user?.email ?? null,
      };
      setSnap(next);
      syncAuthUserToStore(next.userId);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { ...snap, loading };
}

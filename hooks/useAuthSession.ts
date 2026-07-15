import { useEffect, useState } from 'react';

import { syncAuthUserToStore, type AuthSessionSnapshot } from '@/services/authSession';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';

const EMPTY: AuthSessionSnapshot = { isSignedIn: false, userId: null, email: null };
const AUTH_SESSION_FALLBACK_MS = 4_000;

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

    const apply = (next: AuthSessionSnapshot) => {
      if (!active) return;
      setSnap(next);
      syncAuthUserToStore(next.userId);
      setLoading(false);
    };

    const fallback = setTimeout(() => {
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          const user = data.session?.user;
          apply({
            isSignedIn: Boolean(user?.id),
            userId: user?.id ?? null,
            email: user?.email ?? null,
          });
        })
        .catch(() => {
          if (active) apply(EMPTY);
        });
    }, AUTH_SESSION_FALLBACK_MS);

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const user = session?.user;
      const next: AuthSessionSnapshot = {
        isSignedIn: Boolean(user?.id),
        userId: user?.id ?? null,
        email: user?.email ?? null,
      };
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        clearTimeout(fallback);
        apply(next);
      }
    });

    return () => {
      active = false;
      clearTimeout(fallback);
      data.subscription.unsubscribe();
    };
  }, []);

  return { ...snap, loading };
}

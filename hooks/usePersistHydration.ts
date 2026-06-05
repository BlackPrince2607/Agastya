import { useEffect, useState } from 'react';

import { useSessionStore } from '@/store/sessionStore';

const HYDRATION_TIMEOUT_MS = 2500;

/** Waits for zustand-persist hydration before routing on anonymous IDs. */
export function usePersistHydration(): boolean {
  const persistApi = useSessionStore.persist;

  const [hydrated, setHydrated] = useState(() => {
    try {
      return persistApi.hasHydrated();
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      unsub = persistApi.onFinishHydration(() => setHydrated(true));
    } catch {
      setHydrated(true);
    }

    try {
      if (!persistApi.hasHydrated()) {
        void persistApi.rehydrate();
      } else {
        setHydrated(true);
      }
    } catch {
      setHydrated(true);
    }

    timeout = setTimeout(() => setHydrated(true), HYDRATION_TIMEOUT_MS);

    return () => {
      unsub?.();
      if (timeout) clearTimeout(timeout);
    };
  }, [persistApi]);

  return hydrated;
}

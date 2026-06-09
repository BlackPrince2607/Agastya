import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isServerEnvironment } from '@/services/persistentStorage';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';

const HYDRATION_TIMEOUT_MS = Platform.OS === 'web' ? 400 : 2500;

/** Waits for zustand-persist hydration before routing on anonymous IDs. */
export function usePersistHydration(): boolean {
  const persistApi = useSessionStore.persist;

  const [hydrated, setHydrated] = useState(() => {
    if (isServerEnvironment()) return true;
    try {
      return persistApi.hasHydrated();
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isServerEnvironment()) return;

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
      void useTaskStore.persist.rehydrate();
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

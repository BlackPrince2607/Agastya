import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { readAuthSession, syncAuthUserToStore } from '@/services/authSession';
import { bootstrapIdentity } from '@/services/identity';
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

    let finished = false;

    const onHydrated = () => {
      if (finished) return;
      finished = true;
      void (async () => {
        await bootstrapIdentity();
        try {
          const auth = await readAuthSession();
          if (auth.userId) {
            syncAuthUserToStore(auth.userId);
          }
        } catch {
          /* auth probe is best-effort */
        }
      })();
      setHydrated(true);
    };

    try {
      unsub = persistApi.onFinishHydration(onHydrated);
    } catch {
      onHydrated();
    }

    try {
      if (!persistApi.hasHydrated()) {
        void persistApi.rehydrate();
      } else {
        onHydrated();
      }
      void useTaskStore.persist.rehydrate();
    } catch {
      onHydrated();
    }

    timeout = setTimeout(() => onHydrated(), HYDRATION_TIMEOUT_MS);

    return () => {
      unsub?.();
      if (timeout) clearTimeout(timeout);
    };
  }, [persistApi]);

  return hydrated;
}

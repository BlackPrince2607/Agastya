import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { bootstrapIdentity } from '@/services/identity';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { track } from '@/services/analytics';
import { useSessionStore } from '@/store/sessionStore';

function gateDestination() {
  return useSessionStore.getState().hasEnteredMain ? '/(main)/home' : '/welcome';
}

/** Cold start: hydrate → bootstrap identity → welcome or home (cloud restore is non-blocking). */
export default function Gate() {
  const hydrated = usePersistHydration();
  const routedRef = useRef(false);
  const [routed, setRouted] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    const routeOut = () => {
      if (cancelled || routedRef.current) return;
      routedRef.current = true;
      setRouted(true);
      router.replace(gateDestination() as never);
    };

    void bootstrapIdentity();
    void restoreSessionFromServer({ force: false });
    track('identity_bootstrap');

    const fallback = setTimeout(routeOut, 1200);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [hydrated]);

  if (routed) return null;

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 items-center justify-center px-8">
        <LoadingBlock message="Restoring your reading…" />
      </View>
    </CosmicScreen>
  );
}

import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { bootstrapIdentity } from '@/services/identity';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { track } from '@/services/analytics';
import { useSessionStore } from '@/store/sessionStore';

/** Cold start: hydrate → restore cloud session → welcome or home. */
export default function Gate() {
  const hydrated = usePersistHydration();
  const [gateReady, setGateReady] = useState(false);
  const entered = useSessionStore((s) => s.hasEnteredMain);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      await bootstrapIdentity();
      await restoreSessionFromServer({ force: false });
      track('identity_bootstrap');
      setGateReady(true);
    })();
  }, [hydrated]);

  if (!hydrated || !gateReady) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Restoring your reading…" />
        </View>
      </CosmicScreen>
    );
  }

  return <Redirect href={entered ? '/(main)/home' : '/welcome'} />;
}

import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { track } from '@/services/analytics';
import { requestNotificationPermission } from '@/services/notifications';
import { useSessionStore } from '@/store/sessionStore';
import {
  canEnterMainAppSync,
  hasRitualReading,
  prepareReturningUser,
  resolveOnboardingHref,
  resolveSignedInHrefSync,
} from '@/utils/navigationFlow';

function resolveGateHref(target: Href): Href {
  if (target === '/(main)/home') {
    const gate = canEnterMainAppSync();
    if (gate === 'ok') {
      useSessionStore.getState().setEnteredMain(true);
      void requestNotificationPermission();
      return '/(main)/home';
    }
    if (gate === 'need_sign_in') {
      return '/onboarding/account';
    }
    if (hasRitualReading()) {
      useSessionStore.getState().setEnteredMain(true);
      void requestNotificationPermission();
      return '/(main)/home';
    }
    if (useSessionStore.getState().supabaseUserId) {
      return resolveSignedInHrefSync();
    }
    return resolveOnboardingHref();
  }

  const snap = useSessionStore.getState();
  const hasProgress =
    Boolean(snap.previewReading || snap.palmAnalysis || snap.userDisplayName) ||
    snap.focusTopics.length > 0;

  if (target === '/onboarding' && !hasProgress) {
    return '/welcome';
  }

  return target;
}

/** Cold start: hydrate → bootstrap → resume route or welcome. */
export default function Gate() {
  const hydrated = usePersistHydration();
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    void (async () => {
      track('identity_bootstrap');
      try {
        const target = await prepareReturningUser();
        if (cancelled) return;
        setHref(resolveGateHref(target));
      } catch {
        if (!cancelled) setHref('/welcome');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  if (!hydrated || href === null) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Restoring your reading…" />
        </View>
      </CosmicScreen>
    );
  }

  return <Redirect href={href} />;
}

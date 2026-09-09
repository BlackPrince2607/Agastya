import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { AnalyticsEvent, track } from '@/services/analytics';
import { requestNotificationPermission, registerPushTokenWithServer } from '@/services/notifications';
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
      void requestNotificationPermission().then((ok) => {
        if (ok) void registerPushTokenWithServer();
      });
      return '/(main)/home';
    }
    if (gate === 'need_sign_in') {
      return '/onboarding/account';
    }
    if (hasRitualReading()) {
      useSessionStore.getState().setEnteredMain(true);
      void requestNotificationPermission().then((ok) => {
        if (ok) void registerPushTokenWithServer();
      });
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

/** Absolute ceiling so a hung network/DNS never leaves a blank dark gate. */
const GATE_ROUTE_TIMEOUT_MS = 8_000;

function localFallbackHref(): Href {
  const snap = useSessionStore.getState();
  if (snap.hasEnteredMain || hasRitualReading()) {
    return resolveGateHref('/(main)/home');
  }
  if (snap.supabaseUserId) {
    return resolveGateHref(resolveSignedInHrefSync());
  }
  return resolveGateHref(resolveOnboardingHref());
}

/** Cold start: hydrate → bootstrap → resume route or welcome. */
export default function Gate() {
  const hydrated = usePersistHydration();
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    const alreadyEnteredMain = useSessionStore.getState().hasEnteredMain;

    const finish = (nextHref: Href) => {
      if (cancelled) return;
      if (!alreadyEnteredMain && nextHref === '/(main)/home') {
        track(AnalyticsEvent.ONBOARDING_COMPLETED);
      }
      setHref(nextHref);
    };

    void (async () => {
      track(AnalyticsEvent.APP_OPENED);
      track('identity_bootstrap');
      try {
        const target = await Promise.race([
          prepareReturningUser(),
          new Promise<Href>((resolve) => {
            setTimeout(() => resolve(localFallbackHref()), GATE_ROUTE_TIMEOUT_MS);
          }),
        ]);
        finish(resolveGateHref(target));
      } catch {
        finish('/welcome');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  if (!hydrated || href === null) {
    // Inline styles only — avoid NativeWind / CosmicScreen on the cold-start gate so a
    // styling or gradient failure cannot leave a blank dark screen.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0f0e10',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}>
        <LoadingBlock message="Opening Agastya…" />
      </View>
    );
  }

  return <Redirect href={href} />;
}

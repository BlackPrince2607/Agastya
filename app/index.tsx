import { Redirect, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { track } from '@/services/analytics';
import { applyDevAccessGrants } from '@/services/authConfig';
import { applyDevQuickAccess } from '@/services/devAccess';
import { requestNotificationPermission } from '@/services/notifications';
import { useSessionStore } from '@/store/sessionStore';
import { canEnterMainApp, prepareReturningUser, resolveResumeHref } from '@/utils/navigationFlow';

const GATE_TIMEOUT_MS = 6000;

async function resolveGateHref(target: Href): Promise<Href> {
  if (target === '/(main)/home') {
    const gate = await canEnterMainApp();
    if (gate === 'ok') {
      useSessionStore.getState().setEnteredMain(true);
      void requestNotificationPermission();
      return '/(main)/home';
    }
    if (gate === 'need_sign_in') {
      useSessionStore.getState().setEnteredMain(false);
      return '/onboarding/account';
    }
    useSessionStore.getState().setEnteredMain(false);
    return resolveResumeHref();
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

/** Cold start: hydrate → bootstrap → cloud restore → resume route or welcome. */
export default function Gate() {
  const hydrated = usePersistHydration();
  const resolvedRef = useRef(false);
  const finishedRef = useRef(false);
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    if (!hydrated || resolvedRef.current) return;
    resolvedRef.current = true;

    let cancelled = false;

    const finish = (route: Href) => {
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      void resolveGateHref(route).then((resolved) => {
        if (!cancelled) setHref(resolved);
      });
    };

    const bootstrap = async () => {
      track('identity_bootstrap');
      try {
        applyDevAccessGrants();
        applyDevQuickAccess();
        const target = await Promise.race([
          prepareReturningUser(),
          new Promise<Href>((resolve) =>
            setTimeout(() => resolve(resolveResumeHref()), GATE_TIMEOUT_MS),
          ),
        ]);
        finish(target);
      } catch {
        finish('/welcome');
      }
    };

    void bootstrap();

    const fallback = setTimeout(() => {
      if (!cancelled) finish('/welcome');
    }, GATE_TIMEOUT_MS + 1500);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
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

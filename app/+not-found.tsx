import { Stack } from 'expo-router';

import { EmptyState } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { useSessionStore } from '@/store/sessionStore';
import { enterMainApp, resolveResumeHref } from '@/utils/navigationFlow';
import { deferRouterReplace } from '@/utils/routerDefer';

export default function NotFoundScreen() {
  const goHome = () => {
    const snap = useSessionStore.getState();
    if (snap.hasEnteredMain) {
      enterMainApp();
      return;
    }
    deferRouterReplace(resolveResumeHref());
  };

  return (
    <>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <CosmicScreen variant="stitch">
        <EmptyState
          icon="question-circle"
          title="Page not found"
          body="That link is out of date or doesn’t exist. Head back to your home screen."
          actionLabel="Go home"
          onAction={goHome}
        />
      </CosmicScreen>
    </>
  );
}

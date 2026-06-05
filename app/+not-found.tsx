import { Stack, router } from 'expo-router';

import { EmptyState } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <CosmicScreen variant="stitch">
        <EmptyState
          icon="question-circle"
          title="Page not found"
          body="That link is out of date or doesn’t exist. Head back to your home screen."
          actionLabel="Go home"
          onAction={() => router.replace('/')}
        />
      </CosmicScreen>
    </>
  );
}

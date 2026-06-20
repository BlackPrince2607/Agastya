import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { useAuthSession } from '@/hooks/useAuthSession';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { requiresSupabaseSignIn } from '@/services/authConfig';
import { useSessionStore } from '@/store/sessionStore';
import { resolveResumeHref } from '@/utils/navigationFlow';

/** Pushed report stack: detailed report (tabbed) + compatibility. */
export default function ReportLayout() {
  const hydrated = usePersistHydration();
  const entered = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, loading: authLoading } = useAuthSession();

  if (!hydrated || authLoading) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Loading…" />
        </View>
      </CosmicScreen>
    );
  }

  if (!entered) {
    const resume = resolveResumeHref();
    return <Redirect href={resume === '/(main)/home' ? '/welcome' : resume} />;
  }

  if (requiresSupabaseSignIn() && !isSignedIn) {
    return <Redirect href="/onboarding/account" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0f0e10' },
      }}
    />
  );
}

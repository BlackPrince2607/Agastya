import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { colors } from '@/constants/theme';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { useAuthSession } from '@/hooks/useAuthSession';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { requiresSupabaseSignIn } from '@/services/authConfig';
import { leaveMainAppForOnboarding, syncAuthUserToStore } from '@/services/authSession';
import { useSessionStore } from '@/store/sessionStore';
import { resolveBlockedAppHref } from '@/utils/navigationFlow';
import { hasPremiumAccess, previewReportHref } from '@/utils/premiumAccess';

/** Pushed report stack: detailed report (tabbed) + compatibility. */
export default function ReportLayout() {
  const hydrated = usePersistHydration();
  const entered = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, loading: authLoading } = useAuthSession();

  useEffect(() => {
    if (!requiresSupabaseSignIn() || authLoading || isSignedIn) return;
    syncAuthUserToStore(null);
    if (useSessionStore.getState().hasEnteredMain) {
      leaveMainAppForOnboarding();
    }
  }, [authLoading, isSignedIn]);

  if (!hydrated) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Loading…" />
        </View>
      </CosmicScreen>
    );
  }

  if (!hasPremiumAccess()) {
    return <Redirect href={previewReportHref()} />;
  }

  if (!entered) {
    const resume = resolveBlockedAppHref(isSignedIn);
    return <Redirect href={resume === '/(main)/home' ? '/welcome' : resume} />;
  }

  if (requiresSupabaseSignIn() && authLoading) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Loading…" />
        </View>
      </CosmicScreen>
    );
  }

  if (requiresSupabaseSignIn() && !isSignedIn) {
    return <Redirect href="/onboarding/account" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.surfaceLowest },
      }}
    />
  );
}

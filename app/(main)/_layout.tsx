import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingBlock } from '@/components/feedback';
import { type IconName } from '@/components/ui';
import { AnimatedTabIcon } from '@/components/navigation/AnimatedTabIcon';
import MainTabBarBlurBackground from '@/components/navigation/MainTabBarBlurBackground';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { TAB_BAR_BODY_HEIGHT } from '@/constants/layout';
import { colors } from '@/constants/theme';
import { triggerLightTap } from '@/hooks/useHapticTap';
import { useAuthSession } from '@/hooks/useAuthSession';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { requiresSupabaseSignIn } from '@/services/authConfig';
import { isRecentAuthEstablished } from '@/services/authFlow';
import { leaveMainAppForOnboarding, syncAuthUserToStore } from '@/services/authSession';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { canEnterMainAppSync, resolveBlockedAppHref } from '@/utils/navigationFlow';
import { LOCAL_TASKS } from '@/utils/localTasks';

/** Home • Chat • Tasks • Profile (Reports & Compatibility pushed from Home). */
export default function MainTabsLayout() {
  const hydrated = usePersistHydration();
  const entered = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, loading: authLoading, userId } = useAuthSession();
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10);
  const tabBarHeight = TAB_BAR_BODY_HEIGHT + tabBarBottom + 6;
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const storeUserId = useSessionStore((s) => s.supabaseUserId);
  const tasksRemaining = useTaskStore((s) => {
    const list = s.tasks.length ? s.tasks : LOCAL_TASKS;
    return list.filter((t) => !s.completedIds.includes(t.id)).length;
  });
  const tasksTabBadge = palmAnalysis && tasksRemaining > 0 ? tasksRemaining : undefined;
  const gate = canEnterMainAppSync();
  const canShowTabs = gate === 'ok' || (entered && gate !== 'need_sign_in');
  const authPending = authLoading && !isSignedIn && !storeUserId;

  useEffect(() => {
    if (entered) return;
    if (userId) {
      syncAuthUserToStore(userId);
    }
    if (canEnterMainAppSync() === 'ok') {
      useSessionStore.getState().setEnteredMain(true);
    }
  }, [entered, isSignedIn, userId, authLoading]);

  useEffect(() => {
    if (!requiresSupabaseSignIn() || authLoading || isSignedIn || storeUserId || isRecentAuthEstablished()) {
      return;
    }
    syncAuthUserToStore(null);
    if (useSessionStore.getState().hasEnteredMain) {
      leaveMainAppForOnboarding();
    }
  }, [authLoading, isSignedIn, storeUserId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !entered) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [entered]);

  if (!hydrated) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Loading…" />
        </View>
      </CosmicScreen>
    );
  }
  if (!canShowTabs) {
    if (requiresSupabaseSignIn() && authPending) {
      return (
        <CosmicScreen variant="stitch">
          <View className="flex-1 items-center justify-center px-8">
            <LoadingBlock message="Loading…" />
          </View>
        </CosmicScreen>
      );
    }
    const target = resolveBlockedAppHref(isSignedIn);
    return <Redirect href={target} />;
  }

  if (requiresSupabaseSignIn() && authPending) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Loading…" />
        </View>
      </CosmicScreen>
    );
  }

  if (requiresSupabaseSignIn() && !authLoading && !isSignedIn) {
    return <Redirect href="/onboarding/account" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          lineHeight: 14,
          marginTop: 2,
          marginBottom: 6,
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.2)',
          backgroundColor: Platform.OS === 'android' ? 'rgba(8,8,12,0.92)' : 'transparent',
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: tabBarBottom + 2,
          paddingTop: 6,
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
        },
        tabBarBackground: () => <MainTabBarBlurBackground />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(232,225,229,0.45)',
        tabBarActiveBackgroundColor: 'transparent',
      }}>
      <Tabs.Screen
        name="home"
        listeners={{ tabPress: () => void triggerLightTap() }}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <Glyph name="auto_awesome" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        listeners={{ tabPress: () => void triggerLightTap() }}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => <Glyph name="auto_fix_high" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        listeners={{ tabPress: () => void triggerLightTap() }}
        options={{
          title: 'Tasks',
          tabBarBadge: tasksTabBadge,
          tabBarBadgeAccessibilityLabel:
            tasksTabBadge != null
              ? `${tasksRemaining} ${tasksRemaining === 1 ? 'task' : 'tasks'} remaining`
              : undefined,
          tabBarIcon: ({ color, focused }) => <Glyph name="task_alt" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{ tabPress: () => void triggerLightTap() }}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <Glyph name="person" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
    </Tabs>
  );
}

function Glyph({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return <AnimatedTabIcon name={name} color={color} focused={focused} />;
}

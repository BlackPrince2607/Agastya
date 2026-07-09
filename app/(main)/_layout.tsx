import { Redirect, Tabs } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingBlock } from '@/components/feedback';
import { Icon, type IconName } from '@/components/ui';
import MainTabBarBlurBackground from '@/components/navigation/MainTabBarBlurBackground';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { TAB_BAR_BODY_HEIGHT } from '@/constants/layout';
import { useAuthSession } from '@/hooks/useAuthSession';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { requiresSupabaseSignIn } from '@/services/authConfig';
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
  const tasks = useTaskStore((s) => s.tasks);
  const completedIds = useTaskStore((s) => s.completedIds);
  const gate = canEnterMainAppSync();
  const canShowTabs = entered || gate === 'ok';

  useEffect(() => {
    if (entered) return;
    if (userId) {
      syncAuthUserToStore(userId);
    }
    if (canEnterMainAppSync() === 'ok') {
      useSessionStore.getState().setEnteredMain(true);
    }
  }, [entered, isSignedIn, userId, authLoading]);

  const tasksTabBadge = useMemo(() => {
    if (!palmAnalysis) return undefined;
    const list = tasks.length ? tasks : LOCAL_TASKS;
    const remaining = list.filter((t) => !completedIds.includes(t.id)).length;
    return remaining > 0 ? remaining : undefined;
  }, [palmAnalysis, tasks, completedIds]);

  useEffect(() => {
    if (!requiresSupabaseSignIn() || authLoading || isSignedIn) return;
    syncAuthUserToStore(null);
    if (useSessionStore.getState().hasEnteredMain) {
      leaveMainAppForOnboarding();
    }
  }, [authLoading, isSignedIn]);

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
    if (requiresSupabaseSignIn() && authLoading) {
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

  if (requiresSupabaseSignIn() && authLoading) {
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
        tabBarActiveTintColor: '#c084fc',
        tabBarInactiveTintColor: 'rgba(232,225,229,0.45)',
      }}>
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Glyph name="auto_awesome" color={color} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ color }) => <Glyph name="auto_fix_high" color={color} /> }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarBadge: tasksTabBadge,
          tabBarIcon: ({ color }) => <Glyph name="task_alt" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Glyph name="person" color={color} /> }}
      />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
    </Tabs>
  );
}

function Glyph({ name, color }: { name: IconName; color: string }) {
  return <Icon name={name} size={24} color={color} />;
}

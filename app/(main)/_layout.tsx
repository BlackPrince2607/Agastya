import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { Icon, type IconName } from '@/components/ui';
import MainTabBarBlurBackground from '@/components/navigation/MainTabBarBlurBackground';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { useSessionStore } from '@/store/sessionStore';

/** Home • Chat • Tasks • Profile (Reports & Compatibility pushed from Home). */
export default function MainTabsLayout() {
  const hydrated = usePersistHydration();
  const entered = useSessionStore((s) => s.hasEnteredMain);

  if (!hydrated) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Loading…" />
        </View>
      </CosmicScreen>
    );
  }
  if (!entered) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2, letterSpacing: 0.4 },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.2)',
          backgroundColor: Platform.OS === 'android' ? 'rgba(8,8,12,0.92)' : 'transparent',
          elevation: 0,
          height: Platform.OS === 'ios' ? 80 : 70,
          paddingBottom: Platform.OS === 'ios' ? 20 : 12,
          paddingTop: 10,
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
          overflow: 'hidden',
        },
        tabBarBackground: () => <MainTabBarBlurBackground />,
        tabBarActiveTintColor: '#22d3ee',
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
        options={{ title: 'Tasks', tabBarIcon: ({ color }) => <Glyph name="task_alt" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Glyph name="person" color={color} /> }}
      />
    </Tabs>
  );
}

function Glyph({ name, color }: { name: IconName; color: string }) {
  return <Icon name={name} size={24} color={color} />;
}

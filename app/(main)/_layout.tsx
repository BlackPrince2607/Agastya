import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import MainTabBarBlurBackground from '@/components/navigation/MainTabBarBlurBackground';
import { usePersistHydration } from '@/hooks/usePersistHydration';
import { useSessionStore } from '@/store/sessionStore';

type IconName = ComponentProps<typeof FontAwesome>['name'];

/** Home • Chat • Tasks • Profile (+ match, dating, report via shortcuts) */
export default function MainTabsLayout() {
  const hydrated = usePersistHydration();
  const entered = useSessionStore((s) => s.hasEnteredMain);

  if (!hydrated) return null;
  if (!entered) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: Platform.OS === 'android' ? 'rgba(10,10,20,0.96)' : 'transparent',
          elevation: 0,
          height: Platform.OS === 'ios' ? 76 : 68,
          paddingHorizontal: 6,
          paddingBottom: Platform.OS === 'ios' ? 16 : 10,
          paddingTop: 8,
          borderRadius: 24,
          marginHorizontal: 14,
          marginBottom: Platform.OS === 'ios' ? 24 : 16,
          overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        },
        tabBarBackground: () => <MainTabBarBlurBackground />,
        tabBarActiveTintColor: '#a855f7',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Glyph name="home" color={color} /> }} />
      <Tabs.Screen
        name="guide"
        options={{ title: 'Guide', tabBarIcon: ({ color }) => <Glyph name="comments-o" color={color} /> }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Today', tabBarIcon: ({ color }) => <Glyph name="check-circle-o" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'You', tabBarIcon: ({ color }) => <Glyph name="user-o" color={color} /> }}
      />
      <Tabs.Screen name="match" options={{ href: null }} />
      <Tabs.Screen name="dating" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
    </Tabs>
  );
}

function Glyph({ name, color }: { name: IconName; color: string }) {
  return <FontAwesome size={20} name={name} color={color} />;
}

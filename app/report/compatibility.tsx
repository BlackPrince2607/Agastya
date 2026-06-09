import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { CosmicMatchPanel } from '@/components/match/CosmicMatchPanel';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { Icon } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';

export default function CompatibilityScreen() {
  const displayName = useSessionStore((s) => s.userDisplayName);

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <View className="w-full flex-row items-center gap-3 px-1">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
            <Icon name="chevron_left" size={24} color="#22d3ee" />
          </Pressable>
          <Text className="font-headline text-[22px] text-on-surface" accessibilityRole="header">
            Compatibility
          </Text>
        </View>
        <Text className="px-1 font-body text-[14px] text-on-surface-variant">
          Analyzing the celestial alignment between two energetic signatures.
        </Text>
        <CosmicMatchPanel
          defaultSelfName={displayName?.trim() ?? ''}
          onOpenGuide={() => router.push('/chat')}
        />
      </MainTabScroll>
    </CosmicScreen>
  );
}

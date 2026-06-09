import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicMatchPanel } from '@/components/match/CosmicMatchPanel';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { Icon } from '@/components/ui';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import { useSessionStore } from '@/store/sessionStore';

export default function CompatibilityScreen() {
  const insets = useSafeAreaInsets();
  const { horizontalPad } = useLayoutMetrics();
  const displayName = useSessionStore((s) => s.userDisplayName);

  return (
    <CosmicScreen variant="stitch">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          width: '100%',
          alignItems: 'stretch',
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: horizontalPad,
        }}>
        <ScreenBody>
          <View className="w-full gap-5">
            <View className="flex-row items-center gap-3">
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

            <CosmicMatchPanel
              defaultSelfName={displayName?.trim() ?? ''}
              onOpenGuide={() => router.push('/(main)/chat')}
            />
          </View>
        </ScreenBody>
      </ScrollView>
    </CosmicScreen>
  );
}

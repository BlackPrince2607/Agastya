import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PageTitle } from '@/components/feedback';
import { CosmicMatchPanel } from '@/components/match/CosmicMatchPanel';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { Icon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';

export default function CompatibilityScreen() {
  const displayName = useSessionStore((s) => s.userDisplayName);

  return (
    <CosmicScreen variant="stitch">
      <OnboardingScroll bottomInset={48} keyboardShouldPersistTaps="handled">
        <View className="w-full gap-6">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
            <Icon name="chevron_left" size={24} color={colors.cyan} />
          </Pressable>

          <PageTitle title="Compatibility" subtitle="Compare by name or match palm readings with someone special." />

          <CosmicMatchPanel
            defaultSelfName={displayName?.trim() ?? ''}
            onOpenGuide={() => router.push('/chat')}
          />
        </View>
      </OnboardingScroll>
    </CosmicScreen>
  );
}

import { router } from 'expo-router';
import { View } from 'react-native';

import { PageTitle } from '@/components/feedback';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicMatchPanel } from '@/components/match/CosmicMatchPanel';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';

export default function CompatibilityScreen() {
  return (
    <CosmicScreen variant="stitch">
      <OnboardingScroll bottomInset={48} keyboardShouldPersistTaps="handled">
        <View className="w-full gap-6">
          <BackButton />

          <PageTitle title="Compatibility" subtitle="Compare palm readings side by side." />

          <CosmicMatchPanel onOpenGuide={() => router.push('/(main)/chat')} />
        </View>
      </OnboardingScroll>
    </CosmicScreen>
  );
}

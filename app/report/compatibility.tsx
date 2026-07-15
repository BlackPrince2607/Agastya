import { router } from 'expo-router';
import { View } from 'react-native';

import { PageTitle } from '@/components/feedback';
import { BackButton } from '@/components/layout/BackButton';
import { PremiumLockGate } from '@/components/feedback/PremiumLockGate';
import { CosmicMatchPanel } from '@/components/match/CosmicMatchPanel';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';

import { useSessionStore } from '@/store/sessionStore';

export default function CompatibilityScreen() {
  const premium = useSessionStore((s) => s.hasUnlockedPremium);

  if (!premium) {
    return (
      <PremiumLockGate
        title="Compatibility is a Pro feature"
        body="Unlock full access to compare palm readings, see match scores, and explore how you connect."
      />
    );
  }

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

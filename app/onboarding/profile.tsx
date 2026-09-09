import { useState } from 'react';
import { Text, View } from 'react-native';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { StickyActionBar, STICKY_ACTION_BAR_SINGLE } from '@/components/layout/StickyActionBar';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { alertProfileValidationError, ProfileBasicsForm } from '@/components/profile/ProfileBasicsForm';
import { PrimaryButton } from '@/components/ui';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { syncProfileRemote } from '@/services/identity';
import { deferRouterPush } from '@/utils/routerDefer';
import { track } from '@/services/analytics';
import type { Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

export default function ProfileOnboardingScreen() {
  const storedName = useSessionStore((s) => s.userDisplayName);
  const storedGender = useSessionStore((s) => s.userGender);
  const setProfileBasics = useSessionStore((s) => s.setProfileBasics);

  const [name, setName] = useState(storedName ?? '');
  const [gender, setGender] = useState<Gender | undefined>(storedGender);

  const handleContinue = async () => {
    if (!alertProfileValidationError(name, gender)) return;

    setProfileBasics({ displayName: name.trim(), gender });
    try {
      await syncProfileRemote();
    } finally {
      track('onboarding_profile_saved', { gender });
      deferRouterPush('/onboarding/goals');
    }
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 overflow-hidden">
        <OnboardingScroll bottomInset={STICKY_ACTION_BAR_SINGLE}>
          <OnboardingHeader step={ONBOARDING_STEPS.profile} total={ONBOARDING_TOTAL_STEPS} />

          <View>
            <Text className="font-headline text-[26px] leading-8 tracking-tight text-on-surface">
              Tell us a little about you
            </Text>
            <Text className="mt-2 font-body text-[15px] leading-6 text-on-surface-variant">
              We use this to shape your palm reading.
            </Text>
          </View>

          <View className="flex-1 justify-center">
            <ProfileBasicsForm
              bare
              name={name}
              onNameChange={setName}
              gender={gender}
              onGenderChange={setGender}
            />
          </View>
        </OnboardingScroll>

        <StickyActionBar>
          <PrimaryButton label="Continue" onPress={() => void handleContinue()} />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

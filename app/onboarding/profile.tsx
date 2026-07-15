import { useState } from 'react';
import { View } from 'react-native';

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
      <View className="flex-1">
        <OnboardingScroll bottomInset={STICKY_ACTION_BAR_SINGLE}>
          <OnboardingHeader step={ONBOARDING_STEPS.profile} total={ONBOARDING_TOTAL_STEPS} />

          <ProfileBasicsForm
            showIntro
            name={name}
            onNameChange={setName}
            gender={gender}
            onGenderChange={setGender}
          />

        </OnboardingScroll>

        <StickyActionBar>
          <PrimaryButton label="Continue" onPress={() => void handleContinue()} />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

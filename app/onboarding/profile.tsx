import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicTextField, GlassCard, NebulaButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { EntertainmentDisclaimer } from '@/components/legal/EntertainmentDisclaimer';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { syncProfileRemote } from '@/services/identity';
import { deferRouterPush } from '@/utils/routerDefer';
import { track } from '@/services/analytics';
import type { Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

const GENDER_OPTIONS: Array<{ id: Gender; label: string }> = [
  { id: 'female', label: 'Woman' },
  { id: 'male', label: 'Man' },
  { id: 'non_binary', label: 'Non-binary' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

export default function ProfileOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const storedName = useSessionStore((s) => s.userDisplayName);
  const storedGender = useSessionStore((s) => s.userGender);
  const setProfileBasics = useSessionStore((s) => s.setProfileBasics);

  const [name, setName] = useState(storedName ?? '');
  const [gender, setGender] = useState<Gender | undefined>(storedGender);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Your name', 'Please enter at least two characters so we can personalize your reading.');
      return;
    }
    if (!gender) {
      Alert.alert('One more step', 'Choose the option that best fits you—this helps tailor your reading.');
      return;
    }

    setProfileBasics({ displayName: trimmed, gender });
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
        <OnboardingScroll bottomInset={180}>
          <OnboardingHeader step={ONBOARDING_STEPS.profile} total={ONBOARDING_TOTAL_STEPS} />

          <View>
            <Text className="font-label text-[12px] uppercase tracking-[0.1em] text-primary">About you</Text>
            <Text className="mt-4 font-headline text-[28px] leading-9 text-on-surface">
              Tell us a little about you
            </Text>
            <Text className="mt-3 font-body text-[15px] leading-6 text-on-surface-variant">
              We use this to personalize your palm reading. You can sign in later to save it to the cloud.
            </Text>
          </View>

          <GlassCard className="gap-4 p-5">
            <CosmicTextField
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="How should Agastya address you?"
              autoCapitalize="words"
            />
          </GlassCard>

          <GlassCard muted className="gap-4 p-5">
            <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-primary">Gender</Text>
            <View className="gap-3">
              {GENDER_OPTIONS.map((opt) => {
                const active = gender === opt.id;
                return (
                  <Pressable key={opt.id} onPress={() => setGender(opt.id)}>
                    <View
                      className={`rounded-pill border px-5 py-4 ${
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-surface-container-lowest/50'
                      }`}
                      style={
                        active
                          ? {
                              shadowColor: colors.primary,
                              shadowOpacity: 0.35,
                              shadowRadius: 12,
                            }
                          : undefined
                      }>
                      <Text className="font-body-medium text-[15px] text-on-surface">{opt.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <EntertainmentDisclaimer dense />
        </OnboardingScroll>

        <View
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0f0e10]/95 px-6 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 18), zIndex: 20 }}>
          <NebulaButton label="Continue" onPress={() => void handleContinue()} />
        </View>
      </View>
    </CosmicScreen>
  );
}

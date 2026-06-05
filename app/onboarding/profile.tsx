import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stitchSignal } from '@/constants/theme';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StitchOnboardingHeader } from '@/components/onboarding/StitchOnboardingHeader';
import { CosmicButton, GlowCard, GradientText } from '@/components/primitives';
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
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 180, paddingTop: 8 }}>
          <View className="gap-10 px-7">
            <StitchOnboardingHeader ritualStep={{ current: ONBOARDING_STEPS.profile, total: ONBOARDING_TOTAL_STEPS }} />
            <View>
              <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.45em] text-stitch-magenta">
                About you
              </GradientText>
              <Text className="mt-4 font-noto-serif text-[31px] leading-9 tracking-tight text-mist">
                Tell us a little about you
              </Text>
              <Text className="mt-3 font-inter text-[15px] leading-6 text-md-on-surface-variant">
                We use this to personalize your palm reading. You can sign in later to save it to the cloud.
              </Text>
            </View>

            <GlowCard>
              <Text className="text-[11px] uppercase tracking-[0.35em] text-md-primary">Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="How should Agastya address you?"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
                className="mt-4 rounded-3xl border border-white/14 bg-black/45 px-5 py-4 font-inter text-[17px] text-mist"
              />
            </GlowCard>

            <GlowCard muted>
              <Text className="text-[11px] uppercase tracking-[0.35em] text-md-primary">Gender</Text>
              <View className="mt-5 gap-3">
                {GENDER_OPTIONS.map((opt) => {
                  const active = gender === opt.id;
                  return (
                    <Pressable key={opt.id} onPress={() => setGender(opt.id)}>
                      <View style={[styles.genderRow, active ? styles.genderRowActive : styles.genderRowIdle]}>
                        <Text className="text-[15px] font-semibold text-mist">{opt.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </GlowCard>

            <EntertainmentDisclaimer dense />
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0f0e10]/95 px-8 pt-6"
          style={{
            paddingBottom: Math.max(insets.bottom, 20),
            zIndex: 20,
            elevation: 24,
          }}>
          <CosmicButton gradient="nebulaMd3" label="Continue" onPress={() => void handleContinue()} />
        </View>
      </View>
    </CosmicScreen>
  );
}

const styles = StyleSheet.create({
  genderRow: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  genderRowActive: {
    borderColor: stitchSignal,
    backgroundColor: 'rgba(0, 206, 209, 0.12)',
    shadowColor: stitchSignal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 4,
  },
  genderRowIdle: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
});

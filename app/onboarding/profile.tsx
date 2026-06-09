import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { GlassCard, NebulaButton } from '@/components/ui';
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
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 180, paddingTop: 8, paddingHorizontal: 24, gap: 32 }}>
          <OnboardingHeader step={ONBOARDING_STEPS.profile} total={ONBOARDING_TOTAL_STEPS} />

          <View>
            <Text className="font-label text-[12px] uppercase tracking-[0.3em] text-primary">About you</Text>
            <Text className="mt-4 font-headline text-[31px] leading-9 text-on-surface">
              Tell us a little about you
            </Text>
            <Text className="mt-3 font-body text-[15px] leading-6 text-on-surface-variant">
              We use this to personalize your palm reading. You can sign in later to save it to the cloud.
            </Text>
          </View>

          <GlassCard className="gap-4 p-5">
            <Text className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="How should Agastya address you?"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="words"
              className="rounded-pill border border-white/10 bg-surface-container-lowest/50 px-5 py-4 font-body text-[16px] text-on-surface"
            />
          </GlassCard>

          <GlassCard muted className="gap-4 p-5">
            <Text className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Gender</Text>
            <View className="gap-3">
              {GENDER_OPTIONS.map((opt) => {
                const active = gender === opt.id;
                return (
                  <Pressable key={opt.id} onPress={() => setGender(opt.id)}>
                    <View style={[styles.genderRow, active ? styles.genderRowActive : styles.genderRowIdle]}>
                      <Text className="font-body-medium text-[15px] font-semibold text-on-surface">{opt.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <EntertainmentDisclaimer dense />
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0f0e10]/95 px-6 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 18), zIndex: 20 }}>
          <NebulaButton label="Continue" onPress={() => void handleContinue()} />
        </View>
      </View>
    </CosmicScreen>
  );
}

const styles = StyleSheet.create({
  genderRow: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  genderRowActive: {
    borderColor: '#d3beeb',
    backgroundColor: 'rgba(211, 190, 235, 0.12)',
    shadowColor: '#d3beeb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
  genderRowIdle: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15,14,16,0.5)',
  },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { alertProfileValidationError, ProfileBasicsForm } from '@/components/profile/ProfileBasicsForm';
import { NebulaButton, Icon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { syncProfileRemote } from '@/services/identity';
import type { Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const storedName = useSessionStore((s) => s.userDisplayName);
  const storedGender = useSessionStore((s) => s.userGender);
  const setProfileBasics = useSessionStore((s) => s.setProfileBasics);

  const [name, setName] = useState(storedName ?? '');
  const [gender, setGender] = useState<Gender | undefined>(storedGender);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!alertProfileValidationError(name, gender)) return;
    setSaving(true);
    try {
      setProfileBasics({ displayName: name.trim(), gender });
      await syncProfileRemote();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1">
        <OnboardingScroll bottomInset={120}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
            <Icon name="chevron_left" size={24} color={colors.cyan} />
          </Pressable>

          <PageTitle title="Edit profile" subtitle="Update how Agastya addresses you and tailors your reading." />

          <ProfileBasicsForm
            name={name}
            onNameChange={setName}
            gender={gender}
            onGenderChange={setGender}
          />
        </OnboardingScroll>

        <View
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0f0e10]/95 px-6 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16), zIndex: 20 }}>
          <NebulaButton label={saving ? 'Saving…' : 'Save changes'} disabled={saving} onPress={() => void handleSave()} />
        </View>
      </View>
    </CosmicScreen>
  );
}

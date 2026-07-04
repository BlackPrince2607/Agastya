import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/feedback';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { alertProfileValidationError, ProfileBasicsForm } from '@/components/profile/ProfileBasicsForm';
import { FocusTopicsPicker, validateFocusTopics } from '@/components/profile/FocusTopicsPicker';
import { NebulaButton } from '@/components/ui';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { patchSessionProfile } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { syncProfileRemote } from '@/services/identity';
import type { FocusTopic, Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { goBack } from '@/utils/navigationBack';

const EDIT_PROFILE_FOOTER_HEIGHT = 84;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10);
  const dockBottom = TAB_BAR_CLEARANCE + tabBarInset;
  const storedName = useSessionStore((s) => s.userDisplayName);
  const storedGender = useSessionStore((s) => s.userGender);
  const storedTopics = useSessionStore((s) => s.focusTopics);
  const setProfileBasics = useSessionStore((s) => s.setProfileBasics);
  const setFocusTopics = useSessionStore((s) => s.setFocusTopics);

  const [name, setName] = useState(storedName ?? '');
  const [gender, setGender] = useState<Gender | undefined>(storedGender);
  const [topics, setTopics] = useState<FocusTopic[]>(storedTopics.length ? storedTopics : ['growth']);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!alertProfileValidationError(name, gender)) return;
    const topicError = validateFocusTopics(topics);
    if (topicError) {
      Alert.alert('Focus areas', topicError);
      return;
    }

    setSaving(true);
    try {
      setProfileBasics({ displayName: name.trim(), gender });
      setFocusTopics(topics);
      await syncProfileRemote();

      const snap = useSessionStore.getState();
      if (isApiConfigured() && snap.sessionId && snap.deviceInstallId) {
        await patchSessionProfile({
          sessionId: snap.sessionId,
          deviceInstallId: snap.deviceInstallId,
          displayName: name.trim(),
          gender,
          focusTopics: topics,
        });
      }

      goBack({ pathname: '/edit-profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1">
        <OnboardingScroll bottomInset={dockBottom + EDIT_PROFILE_FOOTER_HEIGHT + 16}>
          <BackButton />

          <PageTitle title="Edit profile" subtitle="Update how Agastya addresses you and shapes your reading." />

          <ProfileBasicsForm
            name={name}
            onNameChange={setName}
            gender={gender}
            onGenderChange={setGender}
          />

          <View className="mt-8">
            <FocusTopicsPicker topics={topics} onChange={setTopics} />
          </View>
        </OnboardingScroll>

        <View
          className="absolute left-0 right-0 border-t border-white/10 bg-[#0f0e10]/95 px-6 pt-4"
          style={{ bottom: dockBottom, paddingBottom: 16, zIndex: 20 }}>
          <NebulaButton label={saving ? 'Saving…' : 'Save changes'} disabled={saving} onPress={() => void handleSave()} />
        </View>
      </View>
    </CosmicScreen>
  );
}

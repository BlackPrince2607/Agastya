import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { MotiView } from '@/components/moti/MotiView';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import {
  FloatingActionBar,
  useFloatingActionBarScrollInset,
} from '@/components/profile/FloatingActionBar';
import { FocusTopicsPicker, validateFocusTopics } from '@/components/profile/FocusTopicsPicker';
import { FormSection } from '@/components/profile/FormSection';
import { PrimaryGradientButton } from '@/components/profile/PrimaryGradientButton';
import { alertProfileValidationError, GENDER_OPTIONS } from '@/components/profile/ProfileBasicsForm';
import { SelectionCard } from '@/components/profile/SelectionCard';
import { CosmicTextField, Icon } from '@/components/ui';
import type { AvatarId } from '@/constants/avatars';
import { MAIN_SECTION_GAP } from '@/constants/layout';
import { colors } from '@/constants/theme';
import { patchSessionProfile } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { syncProfileRemote } from '@/services/identity';
import type { FocusTopic, Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

const SAVE_MESSAGES = [
  'Saving your profile...',
  'Updating your spiritual journey...',
  'Almost ready...',
] as const;

type SavePhase = 'idle' | 'saving' | 'success';

function hydrateEditForm() {
  const snap = useSessionStore.getState();
  return {
    name: snap.userDisplayName ?? '',
    gender: snap.userGender,
    avatarId: snap.avatarId ?? undefined,
    topics: snap.focusTopics.length ? snap.focusTopics : (['growth'] as FocusTopic[]),
  };
}

export default function EditProfileScreen() {
  const scrollBottomInset = useFloatingActionBarScrollInset();
  const setProfileBasics = useSessionStore((s) => s.setProfileBasics);
  const setFocusTopics = useSessionStore((s) => s.setFocusTopics);

  const [name, setName] = useState(() => hydrateEditForm().name);
  const [gender, setGender] = useState<Gender | undefined>(() => hydrateEditForm().gender);
  const [avatarId, setAvatarId] = useState<AvatarId | undefined>(() => hydrateEditForm().avatarId);
  const [topics, setTopics] = useState<FocusTopic[]>(() => hydrateEditForm().topics);
  const [savePhase, setSavePhase] = useState<SavePhase>('idle');
  const [saveMessageIndex, setSaveMessageIndex] = useState(0);

  // Tab screens stay mounted — reset so Save is available again on revisit.
  useFocusEffect(
    useCallback(() => {
      const next = hydrateEditForm();
      setName(next.name);
      setGender(next.gender);
      setAvatarId(next.avatarId);
      setTopics(next.topics);
      setSavePhase('idle');
      setSaveMessageIndex(0);
    }, []),
  );

  useEffect(() => {
    if (savePhase !== 'saving') return;
    const id = setInterval(() => {
      setSaveMessageIndex((i) => (i + 1) % SAVE_MESSAGES.length);
    }, 1100);
    return () => clearInterval(id);
  }, [savePhase]);

  const handleSave = async () => {
    if (savePhase !== 'idle') return;
    if (!alertProfileValidationError(name, gender)) return;
    const topicError = validateFocusTopics(topics);
    if (topicError) {
      Alert.alert('Focus areas', topicError);
      return;
    }

    setSavePhase('saving');
    setSaveMessageIndex(0);

    // Apply locally first so Profile reflects changes immediately on return.
    setProfileBasics({ displayName: name.trim(), gender, avatarId: avatarId ?? null });
    setFocusTopics(topics);

    try {
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
    } catch {
      // Local profile is already updated — still return to settings.
    }

    setSavePhase('success');
    await new Promise((r) => setTimeout(r, 450));
    setSavePhase('idle');
    router.replace('/(main)/profile');
  };

  const busy = savePhase === 'saving' || savePhase === 'success';
  const ctaLabel =
    savePhase === 'success'
      ? 'Profile Updated'
      : savePhase === 'saving'
        ? SAVE_MESSAGES[saveMessageIndex]
        : 'Save Changes';

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1">
        <OnboardingScroll bottomInset={scrollBottomInset}>
          <BackButton />

          <View style={{ gap: MAIN_SECTION_GAP }}>
            <FormSection
              index={0}
              title="Profile"
              subtitle="Choose the face Agastya shows for you.">
              <AvatarPicker value={avatarId} onChange={setAvatarId} />
            </FormSection>

            <FormSection
              index={1}
              title="Identity"
              subtitle="How Agastya addresses you in every reading.">
              <CosmicTextField
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                autoCapitalize="words"
                maxLength={40}
                leadingIcon="sparkles-outline"
                accessibilityLabel="Your name"
                accessibilityHint="Enter the name Agastya should use when speaking to you"
              />
            </FormSection>

            <FormSection
              index={2}
              title="Personal Details"
              subtitle="A gentle lens for more resonant guidance."
              muted>
              <View style={{ gap: 12 }}>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectionCard
                    key={opt.id}
                    title={opt.label}
                    description={opt.description}
                    icon={opt.icon}
                    selected={gender === opt.id}
                    onPress={() => setGender(opt.id)}
                    indicator="radio"
                    accessibilityLabel={opt.label}
                    accessibilityHint="Select gender for personalized readings"
                  />
                ))}
              </View>
            </FormSection>

            <FormSection
              index={3}
              title="Focus Areas"
              subtitle="Pick everything that matters — multiple selections welcome.">
              <FocusTopicsPicker topics={topics} onChange={setTopics} hideLabel />
            </FormSection>
          </View>
        </OnboardingScroll>

        <FloatingActionBar>
          <View className="gap-2">
            {savePhase === 'success' ? (
              <MotiView
                from={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 16, stiffness: 240 }}
                className="mb-1 flex-row items-center justify-center gap-2">
                <Icon name="check_circle" size={18} color={colors.cyan} />
                <Text
                  className="font-body-medium text-[14px]"
                  style={{ color: colors.cyan }}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLiveRegion="polite">
                  Profile Updated
                </Text>
              </MotiView>
            ) : null}
            <PrimaryGradientButton
              label={ctaLabel}
              disabled={busy}
              onPress={() => void handleSave()}
              icon={savePhase === 'success' ? <Icon name="check" size={16} color="#fff" /> : undefined}
            />
          </View>
        </FloatingActionBar>
      </View>
    </CosmicScreen>
  );
}

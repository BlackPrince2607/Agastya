import { Alert, Text, View } from 'react-native';

import { SelectionCard } from '@/components/profile/SelectionCard';
import { CosmicTextField, GlassCard } from '@/components/ui';
import type { IconName } from '@/components/ui';
import type { Gender } from '@/store/sessionStore';

export const GENDER_OPTIONS: Array<{
  id: Gender;
  label: string;
  description: string;
  icon: IconName;
}> = [
  { id: 'male', label: 'Male', description: 'Readings shaped with this lens', icon: 'person' },
  { id: 'female', label: 'Female', description: 'Readings shaped with this lens', icon: 'person' },
];

type ProfileBasicsFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  gender?: Gender;
  onGenderChange: (value: Gender) => void;
  showIntro?: boolean;
  /** Hide outer glass wrapping when parent already provides section cards. */
  bare?: boolean;
};

export function validateProfileBasics(name: string, gender?: Gender): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return 'Please enter at least two characters so we can personalize your reading.';
  }
  if (!gender) {
    return 'Choose the option that best fits you. This helps shape your reading.';
  }
  return null;
}

export function alertProfileValidationError(name: string, gender?: Gender): boolean {
  const error = validateProfileBasics(name, gender);
  if (error) {
    Alert.alert('Profile', error);
    return false;
  }
  return true;
}

export function ProfileBasicsForm({
  name,
  onNameChange,
  gender,
  onGenderChange,
  showIntro = false,
  bare = false,
}: ProfileBasicsFormProps) {
  const nameField = (
    <CosmicTextField
      label="Your name"
      value={name}
      onChangeText={onNameChange}
      placeholder="What should we call you?"
      autoCapitalize="words"
      maxLength={40}
      leadingIcon="sparkles-outline"
      accessibilityLabel="Your name"
      accessibilityHint="Enter the name Agastya should use when speaking to you"
    />
  );

  const genderField = (
    <View className="gap-3">
      {!bare ? (
        <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-primary" maxFontSizeMultiplier={1.3}>
          Gender
        </Text>
      ) : null}
      <View className="gap-2.5">
        {GENDER_OPTIONS.map((opt) => (
          <SelectionCard
            key={opt.id}
            title={opt.label}
            description={opt.description}
            icon={opt.icon}
            selected={gender === opt.id}
            onPress={() => onGenderChange(opt.id)}
            indicator="radio"
            accessibilityLabel={opt.label}
            accessibilityHint="Select gender for personalized readings"
          />
        ))}
      </View>
    </View>
  );

  if (bare) {
    return (
      <View className="w-full gap-8">
        {nameField}
        {genderField}
      </View>
    );
  }

  return (
    <View className="w-full gap-6">
      {showIntro ? (
        <View>
          <Text className="font-label text-[12px] uppercase tracking-[0.1em] text-primary">About you</Text>
          <Text className="mt-4 font-headline text-[28px] leading-9 text-on-surface">Tell us a little about you</Text>
          <Text className="mt-3 font-body text-[15px] leading-6 text-on-surface-variant">
            We use this to shape your palm reading. You can sign in later to save it to the cloud.
          </Text>
        </View>
      ) : null}

      <GlassCard className="gap-4 p-5">{nameField}</GlassCard>
      <GlassCard muted className="gap-4 p-5">
        {genderField}
      </GlassCard>
    </View>
  );
}

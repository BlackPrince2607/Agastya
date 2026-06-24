import { Alert, Pressable, Text, View } from 'react-native';

import { CosmicTextField, GlassCard } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { Gender } from '@/store/sessionStore';

export const GENDER_OPTIONS: Array<{ id: Gender; label: string }> = [
  { id: 'female', label: 'Woman' },
  { id: 'male', label: 'Man' },
  { id: 'non_binary', label: 'Non-binary' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

type ProfileBasicsFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  gender?: Gender;
  onGenderChange: (value: Gender) => void;
  showIntro?: boolean;
};

export function validateProfileBasics(name: string, gender?: Gender): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return 'Please enter at least two characters so we can personalize your reading.';
  }
  if (!gender) {
    return 'Choose the option that best fits you—this helps tailor your reading.';
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

export function ProfileBasicsForm({ name, onNameChange, gender, onGenderChange, showIntro = false }: ProfileBasicsFormProps) {
  return (
    <View className="w-full gap-5">
      {showIntro ? (
        <View>
          <Text className="font-label text-[12px] uppercase tracking-[0.1em] text-primary">About you</Text>
          <Text className="mt-4 font-headline text-[28px] leading-9 text-on-surface">Tell us a little about you</Text>
          <Text className="mt-3 font-body text-[15px] leading-6 text-on-surface-variant">
            We use this to personalize your palm reading. You can sign in later to save it to the cloud.
          </Text>
        </View>
      ) : null}

      <GlassCard className="gap-4 p-5">
        <CosmicTextField
          label="Your name"
          value={name}
          onChangeText={onNameChange}
          placeholder="How should Agastya address you?"
          autoCapitalize="words"
          maxLength={40}
        />
      </GlassCard>

      <GlassCard muted className="gap-4 p-5">
        <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-primary">Gender</Text>
        <View className="gap-3">
          {GENDER_OPTIONS.map((opt) => {
            const active = gender === opt.id;
            return (
              <Pressable key={opt.id} onPress={() => onGenderChange(opt.id)} accessibilityRole="button">
                <View
                  className={`rounded-pill border px-5 py-4 ${
                    active ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface-container-lowest/50'
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
    </View>
  );
}

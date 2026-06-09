import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BrandWordmark, Icon } from '@/components/ui';
import { gradients } from '@/constants/theme';

type OnboardingHeaderProps = {
  /** Current ritual step (1-indexed). */
  step?: number;
  total?: number;
  showBack?: boolean;
  onBack?: () => void;
};

/** Clean onboarding top bar: close/back, Agastya wordmark, labeled progress. */
export function OnboardingHeader({ step, total = 7, showBack = true, onBack }: OnboardingHeaderProps) {
  const frac = step ? Math.min(1, Math.max(0, step / total)) : 0;

  return (
    <View className="mb-5 px-1">
      <View className="flex-row items-center justify-between">
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack ?? (() => router.back())}
            className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
            <Icon name="chevron_left" size={24} color="rgba(232,225,229,0.92)" />
          </Pressable>
        ) : (
          <View className="h-11 w-11" />
        )}
        <BrandWordmark className="text-[13px] tracking-[0.42em]" />
        <View className="h-11 w-11" />
      </View>

      {step ? (
        <View className="mt-5">
          <View className="mb-2 flex-row items-end justify-between px-0.5">
            <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-on-surface-variant">
              Progress
            </Text>
            <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-primary">
              Step {step} of {total}
            </Text>
          </View>
          <View className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <LinearGradient
              colors={[...gradients.nebula]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ height: '100%', width: `${frac * 100}%`, borderRadius: 999 }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

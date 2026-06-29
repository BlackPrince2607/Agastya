import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui';
import { colors } from '@/constants/theme';

type BackButtonProps = {
  onPress?: () => void;
  accessibilityLabel?: string;
  color?: string;
};

/** Consistent circular back affordance across stack screens. */
export function BackButton({ onPress, accessibilityLabel = 'Back', color = colors.cyan }: BackButtonProps) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
      <Icon name="chevron_left" size={24} color={color} />
    </Pressable>
  );
}

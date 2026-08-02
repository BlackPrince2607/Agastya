import { useLocalSearchParams, usePathname, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { goBack, normalizeRouteParams } from '@/utils/navigationBack';

type BackButtonProps = {
  onPress?: () => void;
  fallback?: Href;
  accessibilityLabel?: string;
  color?: string;
};

/** Consistent circular back affordance across stack screens. */
export function BackButton({
  onPress,
  fallback,
  accessibilityLabel = 'Back',
  color = colors.onSurface,
}: BackButtonProps) {
  const pathname = usePathname();
  const segments = useSegments();
  const params = normalizeRouteParams(useLocalSearchParams());

  return (
    <Pressable
      onPress={() =>
        goBack({
          pathname,
          segments: [...segments],
          params,
          fallback,
          onCustomBack: onPress,
        })
      }
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
      <Icon name="chevron_left" size={24} color={color} />
    </Pressable>
  );
}

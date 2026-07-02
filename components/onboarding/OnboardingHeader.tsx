import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, usePathname, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BrandWordmark, Icon } from '@/components/ui';
import { gradients } from '@/constants/theme';
import { goBack, normalizeRouteParams } from '@/utils/navigationBack';

type OnboardingHeaderProps = {
  /** Current ritual step (1-indexed). */
  step?: number;
  total?: number;
  showBack?: boolean;
  /** Use close (X) instead of back chevron — account / sign-in screens. */
  useClose?: boolean;
  onBack?: () => void;
  /** Override automatic back routing when history is empty. */
  backHref?: Href;
};

/** Clean onboarding top bar: close/back, Agastya wordmark, labeled progress. */
export function OnboardingHeader({
  step,
  total = 7,
  showBack = true,
  useClose = false,
  onBack,
  backHref,
}: OnboardingHeaderProps) {
  const pathname = usePathname();
  const segments = useSegments();
  const params = normalizeRouteParams(useLocalSearchParams());
  const frac = step ? Math.min(1, Math.max(0, step / total)) : 0;

  const handleBack = () => {
    goBack({
      pathname,
      segments: [...segments],
      params,
      fallback: backHref,
      onCustomBack: onBack,
    });
  };

  return (
    <View className="mb-5 px-1">
      <View className="flex-row items-center justify-between">
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={useClose ? 'Close' : 'Go back'}
            onPress={handleBack}
            className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
            <Icon
              name={useClose ? 'close' : 'chevron_left'}
              size={useClose ? 22 : 24}
              color="rgba(232,225,229,0.92)"
            />
          </Pressable>
        ) : (
          <View className="h-11 w-11" />
        )}
        <BrandWordmark size="sm" />
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

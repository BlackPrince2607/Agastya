import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBody } from '@/components/layout/ScreenBody';
import { PAGE_PADDING, SECTION_GAP } from '@/constants/layout';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';

type OnboardingScrollProps = PropsWithChildren<
  Pick<ScrollViewProps, 'keyboardShouldPersistTaps' | 'showsVerticalScrollIndicator'>
> & {
  bottomInset?: number;
};

/** Consistent onboarding / auth scroll container with page padding. */
export function OnboardingScroll({
  children,
  bottomInset = 32,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
}: OnboardingScrollProps) {
  const insets = useSafeAreaInsets();
  const { horizontalPad } = useLayoutMetrics();
  const pad = Math.max(PAGE_PADDING, horizontalPad);

  return (
    <ScrollView
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={{
        paddingHorizontal: pad,
        paddingTop: 8,
        paddingBottom: insets.bottom + bottomInset,
        gap: SECTION_GAP,
      }}>
      <ScreenBody>{children}</ScreenBody>
    </ScrollView>
  );
}

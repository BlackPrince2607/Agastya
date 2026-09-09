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

/**
 * Compact onboarding body — grows to fill the screen so short steps feel like
 * one composition, but still scrolls when content overflows (small phones / keyboard).
 */
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
      style={{ flex: 1 }}
      bounces={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: pad,
        paddingTop: 12,
        paddingBottom: insets.bottom + bottomInset,
        gap: SECTION_GAP,
      }}>
      <ScreenBody style={{ flexGrow: 1, gap: SECTION_GAP, justifyContent: 'flex-start' }}>
        {children}
      </ScreenBody>
    </ScrollView>
  );
}

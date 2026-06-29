import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBody } from '@/components/layout/ScreenBody';
import { MAIN_SECTION_GAP, PAGE_PADDING, SECTION_GAP } from '@/constants/layout';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';

type StackScrollProps = PropsWithChildren<
  Pick<ScrollViewProps, 'contentContainerStyle' | 'showsVerticalScrollIndicator' | 'keyboardShouldPersistTaps'>
> & {
  horizontalPadding?: number;
  sectionGap?: number;
  bottomInset?: number;
};

/** Scroll container for pushed stack screens (no tab-bar clearance). */
export function StackScroll({
  children,
  horizontalPadding,
  sectionGap = MAIN_SECTION_GAP,
  bottomInset = 32,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps = 'handled',
}: StackScrollProps) {
  const insets = useSafeAreaInsets();
  const { horizontalPad } = useLayoutMetrics();
  const pad = horizontalPadding ?? Math.max(PAGE_PADDING, horizontalPad);

  return (
    <ScrollView
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={[
        {
          gap: sectionGap,
          paddingTop: 8,
          paddingBottom: insets.bottom + bottomInset,
          paddingHorizontal: pad,
          alignItems: 'stretch',
          width: '100%',
        },
        contentContainerStyle,
      ]}>
      <ScreenBody>{children}</ScreenBody>
    </ScrollView>
  );
}

/** Default section gap for stack screens that need tighter rhythm. */
export const STACK_SECTION_GAP = SECTION_GAP;

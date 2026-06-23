import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { ScreenBody } from '@/components/layout/ScreenBody';
import { SECTION_GAP, TAB_BAR_CLEARANCE } from '@/constants/layout';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';

type MainTabScrollProps = PropsWithChildren<
  Pick<ScrollViewProps, 'contentContainerStyle' | 'showsVerticalScrollIndicator'>
> & {
  horizontalPadding?: number;
};

/** Scroll container sized for floating tab bar on main screens. */
export function MainTabScroll({
  children,
  horizontalPadding,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
}: MainTabScrollProps) {
  const { horizontalPad } = useLayoutMetrics();
  const pad = horizontalPadding ?? horizontalPad;

  return (
    <ScrollView
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          gap: SECTION_GAP,
          paddingTop: 8,
          paddingBottom: TAB_BAR_CLEARANCE,
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

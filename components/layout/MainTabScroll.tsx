import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { ScreenBody } from '@/components/layout/ScreenBody';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';

const TAB_BAR_CLEARANCE = 260;

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
          gap: 18,
          paddingTop: 8,
          paddingBottom: TAB_BAR_CLEARANCE,
          paddingHorizontal: pad,
          alignItems: 'center',
        },
        contentContainerStyle,
      ]}>
      <ScreenBody>{children}</ScreenBody>
    </ScrollView>
  );
}

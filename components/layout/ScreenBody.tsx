import type { PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';

type ScreenBodyProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

/** Centers main content on wide screens (web / tablet). */
export function ScreenBody({ children, style }: ScreenBodyProps) {
  const { contentWidth } = useLayoutMetrics();

  return (
    <View
      style={[{ width: '100%', maxWidth: contentWidth, alignSelf: 'center', alignItems: 'stretch' }, style]}>
      {children}
    </View>
  );
}

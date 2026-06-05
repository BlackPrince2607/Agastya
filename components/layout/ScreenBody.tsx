import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';

/** Centers main content on wide screens (web / tablet). */
export function ScreenBody({ children }: PropsWithChildren) {
  const { contentWidth } = useLayoutMetrics();

  return (
    <View style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center' }}>
      {children}
    </View>
  );
}

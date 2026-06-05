import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type WelcomeBlurShellProps = {
  intensity?: number;
  tint?: string;
  style?: StyleProp<ViewStyle>;
  /** Extra styles merged only on platforms that omit native blur */
  fallbackStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function WelcomeBlurShell({ style, fallbackStyle, children }: WelcomeBlurShellProps) {
  return <View style={[style, fallbackStyle]}>{children}</View>;
}

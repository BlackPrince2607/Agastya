import { BlurView, type BlurTint } from 'expo-blur';

import type { WelcomeBlurShellProps } from './WelcomeBlurShell';

export function WelcomeBlurShell({
  intensity = 50,
  tint = 'dark',
  style,
  children,
}: WelcomeBlurShellProps) {
  return (
    <BlurView intensity={intensity} tint={tint as BlurTint} style={style}>
      {children}
    </BlurView>
  );
}

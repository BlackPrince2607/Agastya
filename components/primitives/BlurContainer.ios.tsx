import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';

import type { ViewProps } from 'react-native';

type BlurContainerProps = ViewProps & {
  intensity?: number;
  className?: string;
  children?: ReactNode;
};

export function BlurContainer({
  intensity = 40,
  className,
  children,
  ...rest
}: BlurContainerProps) {
  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      className={`overflow-hidden rounded-3xl border border-white/10 ${className ?? ''}`}
      {...rest}>
      {children}
    </BlurView>
  );
}

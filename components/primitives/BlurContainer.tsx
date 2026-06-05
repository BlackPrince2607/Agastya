import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

type BlurContainerProps = ViewProps & {
  intensity?: number;
  className?: string;
  children?: ReactNode;
};

export function BlurContainer({
  intensity: _intensity,
  className,
  children,
  ...rest
}: BlurContainerProps) {
  return (
    <View
      className={`overflow-hidden rounded-3xl border border-white/10 bg-cosmic-nebula/80 ${className ?? ''}`}
      {...rest}>
      {children}
    </View>
  );
}

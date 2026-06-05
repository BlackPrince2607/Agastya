import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type GlowCardProps = PropsWithChildren<ViewProps & { muted?: boolean }>;

export function GlowCard({ muted, className, children, ...rest }: GlowCardProps) {
  const ring = muted
    ? 'border-white/10 shadow-none'
    : 'border-white/15 shadow-glow-sm';

  return (
    <View
      className={`rounded-4xl border bg-white/5 p-5 backdrop-blur ${ring} ${className ?? ''}`}
      {...rest}>
      {children}
    </View>
  );
}

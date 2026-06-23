import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type GlowCardProps = PropsWithChildren<ViewProps & { muted?: boolean }>;

export function GlowCard({ muted, className, children, ...rest }: GlowCardProps) {
  const ring = muted
    ? 'border-white/10 shadow-none'
    : 'border-white/15 shadow-glow-sm';

  return (
    <View
      className={`rounded-glass border bg-white/[0.05] p-5 ${ring} ${className ?? ''}`}
      {...rest}>
      {children}
    </View>
  );
}

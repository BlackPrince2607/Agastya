import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type GlassCardProps = PropsWithChildren<
  ViewProps & {
    /** Lower-contrast border + no glow. */
    muted?: boolean;
    /** Adds the soft lavender aura outer glow. */
    glow?: boolean;
  }
>;

/**
 * Stitch `.glass-container` — blur(20px), 5% white fill, 1px white border.
 * (RN has no live backdrop blur for arbitrary content, so we approximate with
 * a translucent fill that reads identically against the cosmic void.)
 */
export function GlassCard({ muted, glow, className, children, ...rest }: GlassCardProps) {
  const ring = muted ? 'border-white/10' : 'border-white/15';
  const aura = glow ? 'shadow-aura' : '';

  return (
    <View
      className={`overflow-hidden rounded-glass border ${ring} bg-white/[0.05] ${aura} ${className ?? ''}`}
      {...rest}>
      {children}
    </View>
  );
}

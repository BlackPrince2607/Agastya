import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { elevation, gradients } from '@/constants/theme';

type GlassCardProps = PropsWithChildren<
  ViewProps & {
    /** Lower-contrast border + no glow. */
    muted?: boolean;
    /** Adds the soft lavender aura outer glow. */
    glow?: boolean;
    /** Flex/layout classes for the content layer above the gradient. */
    innerClassName?: string;
  }
>;

/**
 * Stitch `.glass-container` — translucent fill, soft white border, optional glow.
 * (RN has no live backdrop blur for arbitrary content, so we approximate with
 * a translucent fill that reads identically against the cosmic void.)
 */
export function GlassCard({ muted, glow, className, innerClassName, children, style, ...rest }: GlassCardProps) {
  const ring = muted ? 'border-white/10' : 'border-white/[0.14]';
  const aura = glow ? 'shadow-aura' : '';
  // Allow callers to opt into overflow-visible (e.g. gradient labels) via className.
  const clips = !(className ?? '').includes('overflow-visible');

  return (
    <View
      className={`${clips ? 'overflow-hidden' : 'overflow-visible'} rounded-glass border ${ring} bg-white/[0.055] ${aura} ${className ?? ''}`}
      style={[glow ? elevation.aura : undefined, style]}
      {...rest}>
      {!muted ? (
        <LinearGradient
          colors={[...gradients.aurora]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      <View className={`relative z-10 w-full ${innerClassName ?? ''}`}>{children}</View>
    </View>
  );
}

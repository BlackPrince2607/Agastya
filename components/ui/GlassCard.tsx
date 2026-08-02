import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, radii } from '@/constants/theme';

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
 *
 * Glow cards: purple lives on the outer ring + aura only. The text sits on an
 * even dark panel inset from that ring so the two never mix on the edge.
 */
export function GlassCard({ muted, glow, className, innerClassName, children, style, ...rest }: GlassCardProps) {
  const clips = !(className ?? '').includes('overflow-visible');

  if (glow && !muted) {
    const borderW = 1.5;
    return (
      <View
        className={`w-full rounded-glass ${className ?? ''}`}
        style={[
          {
            // Symmetric aura — a downward offset made the dark panel look skewed vs the rim.
            shadowColor: colors.purple,
            shadowOpacity: 0.32,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
            backgroundColor: colors.surfaceLow,
            borderRadius: radii.glass,
            borderWidth: borderW,
            borderColor: 'rgba(168,85,247,0.5)',
            overflow: clips ? 'hidden' : 'visible',
          },
          style,
        ]}
        {...rest}>
        {/* Even dark fill — fully inside the purple ring */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: colors.surfaceLow,
            borderRadius: radii.glass - borderW,
          }}
        />
        {/* Soft wash on top of the fill (not under/through the border) */}
        <LinearGradient
          colors={[...gradients.aurora]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radii.glass - borderW,
          }}
        />
        <View className={`relative z-10 w-full ${innerClassName ?? ''}`}>{children}</View>
      </View>
    );
  }

  const ring = muted ? 'border-white/10' : 'border-white/[0.14]';
  const shellClass = `${clips ? 'overflow-hidden' : 'overflow-visible'} rounded-glass border ${ring} bg-white/[0.055] ${className ?? ''}`;

  return (
    <View className={shellClass} style={style} {...rest}>
      {!muted ? (
        <LinearGradient
          colors={[...gradients.aurora]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radii.glass,
          }}
        />
      ) : null}
      <View className={`relative z-10 w-full ${innerClassName ?? ''}`}>{children}</View>
    </View>
  );
}

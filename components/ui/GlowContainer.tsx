import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { colors, elevation } from '@/constants/theme';

type GlowContainerProps = PropsWithChildren<
  ViewProps & {
    /** Softness of the purple aura. */
    intensity?: 'soft' | 'medium' | 'strong';
  }
>;

const INTENSITY = {
  soft: { shadowOpacity: 0.22, shadowRadius: 18, elevation: 6 },
  medium: elevation.aura,
  strong: { ...elevation.cta, shadowOpacity: 0.48, shadowRadius: 34 },
} as const;

/**
 * Soft purple glow wrapper for hero accents, CTAs, and focal cards.
 * Keeps glow styling consistent without duplicating shadow tokens.
 */
export function GlowContainer({
  intensity = 'medium',
  className,
  style,
  children,
  ...rest
}: GlowContainerProps) {
  const glow = INTENSITY[intensity];

  return (
    <View
      className={className}
      style={[
        {
          shadowColor: colors.purple,
          shadowOffset: { width: 0, height: 10 },
          ...glow,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

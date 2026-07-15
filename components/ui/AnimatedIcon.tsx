import type { ReactNode } from 'react';
import { memo } from 'react';
import { View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors } from '@/constants/theme';

type AnimatedIconProps = {
  name?: IconName;
  size?: number;
  color?: string;
  /** Optional custom child instead of an Icon glyph. */
  children?: ReactNode;
  /** Soft float animation. */
  float?: boolean;
  /** Gentle pulse on the outer shell. */
  pulse?: boolean;
  className?: string;
};

/**
 * Icon with a light float / pulse — for insight cards and empty states.
 * Animation stays subtle so it reads as polish, not decoration noise.
 */
function AnimatedIconComponent({
  name = 'auto_awesome',
  size = 28,
  color = colors.purple,
  children,
  float = true,
  pulse = true,
  className,
}: AnimatedIconProps) {
  return (
    <MotiView
      from={pulse ? { scale: 0.96, opacity: 0.88 } : undefined}
      animate={pulse ? { scale: 1, opacity: 1 } : undefined}
      transition={pulse ? { type: 'timing', duration: 2400, loop: true } : undefined}
      className={className}>
      <View
        className="items-center justify-center rounded-2xl border border-white/12"
        style={{
          width: size + 28,
          height: size + 28,
          backgroundColor: 'rgba(168,85,247,0.16)',
        }}>
        <MotiView
          from={float ? { translateY: 0 } : undefined}
          animate={float ? { translateY: -3 } : undefined}
          transition={float ? { type: 'timing', duration: 2200, loop: true } : undefined}>
          {children ?? <Icon name={name} size={size} color={color} />}
        </MotiView>
      </View>
    </MotiView>
  );
}

export const AnimatedIcon = memo(AnimatedIconComponent);

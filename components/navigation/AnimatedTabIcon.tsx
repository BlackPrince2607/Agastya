import { memo } from 'react';
import { View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { Icon, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';

type AnimatedTabIconProps = {
  name: IconName;
  color: string;
  focused: boolean;
};

/**
 * Tab bar glyph with soft scale + glow when active.
 */
function AnimatedTabIconComponent({ name, color, focused }: AnimatedTabIconProps) {
  return (
    <View className="items-center justify-center" style={{ width: 48, height: 28 }}>
      {focused ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 34,
            height: 34,
            borderRadius: 999,
            backgroundColor: 'rgba(192,132,252,0.16)',
          }}
        />
      ) : null}
      <MotiView
        animate={{
          scale: focused ? 1.1 : 1,
        }}
        transition={{ type: 'timing', duration: 200 }}>
        <Icon name={name} size={24} color={color} />
      </MotiView>
      <MotiView
        animate={{
          opacity: focused ? 1 : 0,
          scaleX: focused ? 1 : 0.4,
        }}
        transition={{ type: 'timing', duration: 220 }}
        style={{
          position: 'absolute',
          bottom: -2,
          width: 14,
          height: 3,
          borderRadius: 999,
          backgroundColor: colors.primary,
          shadowColor: colors.purple,
          shadowOpacity: focused ? 0.65 : 0,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

export const AnimatedTabIcon = memo(AnimatedTabIconComponent);

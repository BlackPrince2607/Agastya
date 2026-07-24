import type { PropsWithChildren } from 'react';
import {
  Platform,
  Pressable,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MotiPressable } from 'moti/interactions';

import { triggerLightTap } from '@/hooks/useHapticTap';

type PressableScaleProps = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Shared press feedback: slight scale + optional haptic.
 * Uses Pressable on web (MotiPressable can swallow taps there).
 */
export function PressableScale({
  onPress,
  disabled,
  haptic = true,
  scaleTo = 0.975,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  style,
  children,
}: PressableScaleProps) {
  const handlePress = () => {
    if (disabled || !onPress) return;
    if (haptic) void triggerLightTap();
    onPress();
  };

  if (Platform.OS === 'web' || !onPress) {
    return (
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
        disabled={disabled || !onPress}
        onPress={onPress ? handlePress : undefined}
        style={({ pressed }) => [
          style,
          {
            opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
            transform: [{ scale: pressed && !disabled && onPress ? scaleTo : 1 }],
          },
        ]}>
        {children}
      </Pressable>
    );
  }

  return (
    <MotiPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={handlePress}
      animate={({ pressed }) => ({
        scale: pressed && !disabled ? scaleTo : 1,
        opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
      })}
      transition={{ type: 'spring', damping: 18, stiffness: 280 }}
      style={style}>
      {children}
    </MotiPressable>
  );
}

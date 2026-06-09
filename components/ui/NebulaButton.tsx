import { LinearGradient } from 'expo-linear-gradient';
import { MotiPressable } from 'moti/interactions';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { gradients } from '@/constants/theme';
import { triggerLightTap } from '@/hooks/useHapticTap';

type NebulaButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'nebula' | 'cta' | 'ghost';
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
};

/**
 * Primary action button. `nebula` = lavender Stitch CTA, `cta` = cyan→purple
 * high-impact (paywall), `ghost` = glass outline secondary.
 */
export function NebulaButton({
  label,
  onPress,
  variant = 'nebula',
  disabled,
  icon,
  className,
}: NebulaButtonProps) {
  const handlePress = () => {
    void triggerLightTap();
    onPress();
  };

  if (variant === 'ghost') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={handlePress}
        className={`flex-row items-center justify-center gap-2 rounded-pill border border-white/20 bg-white/[0.06] px-8 py-4 ${className ?? ''}`}
        style={({ pressed }) => ({
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        })}>
        {icon}
        <Text className="font-label uppercase tracking-[0.1em] text-on-surface-variant">{label}</Text>
      </Pressable>
    );
  }

  const palette = variant === 'cta' ? gradients.cta : gradients.nebula;
  const textColor = variant === 'cta' ? '#ffffff' : '#38294d';

  return (
    <MotiPressable
      animate={({ pressed }) => ({
        scale: pressed && !disabled ? 0.97 : 1,
        opacity: disabled ? 0.55 : 1,
      })}
      onPress={handlePress}
      disabled={disabled}>
      <LinearGradient
        colors={[...palette]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 999, overflow: 'hidden' }}>
        <View className={`flex-row items-center justify-center gap-3 px-10 py-4 ${className ?? ''}`}>
          {icon}
          <Text
            className="font-label text-center uppercase tracking-[0.1em]"
            style={{ color: textColor }}>
            {label}
          </Text>
        </View>
      </LinearGradient>
    </MotiPressable>
  );
}

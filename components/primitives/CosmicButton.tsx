import { LinearGradient } from 'expo-linear-gradient';
import { MotiPressable } from 'moti/interactions';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cosmicGradients } from '@/constants/theme';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';

type CosmicButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  /** Primary fill — `nebulaMd3` matches Stitch HTML CTAs */
  gradient?: keyof Pick<typeof cosmicGradients, 'pulse' | 'nebulaMd3'>;
  disabled?: boolean;
  /** Shown before label on primary buttons */
  icon?: ReactNode;
};

export function CosmicButton({
  label,
  onPress,
  variant = 'primary',
  gradient = 'pulse',
  disabled,
  icon,
}: CosmicButtonProps) {
  if (variant === 'ghost') {
    // Single Pressable — nested Pressable without onPress was swallowing taps (MotiPressable never fired).
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          void triggerLightTap();
          onPress();
        }}
        className="items-center rounded-3xl border border-white/25 bg-white/5 px-8 py-4 active:opacity-90"
        style={({ pressed }) => ({
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        })}>
        <Text className="font-medium tracking-wide text-mist">{label}</Text>
      </Pressable>
    );
  }

  return (
    <MotiPressable
      animate={({ pressed }) => ({
        scale: pressed && !disabled ? 0.97 : 1,
        opacity: disabled ? 0.55 : 1,
      })}
      onPress={() => {
        void triggerLightTap();
        onPress();
      }}
      disabled={disabled}>
      <LinearGradient
        colors={[...cosmicGradients[gradient]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 999, overflow: 'hidden' }}>
        <View className="flex-row items-center justify-center gap-3 px-10 py-4" accessibilityRole="button">
          {icon}
          <Text
            className={`text-center font-semibold tracking-[0.2em] ${gradient === 'nebulaMd3' ? 'font-space-grotesk' : 'text-white'}`}
            style={gradient === 'nebulaMd3' ? { color: stitchMd3.onPrimary } : undefined}>
            {label}
          </Text>
        </View>
      </LinearGradient>
    </MotiPressable>
  );
}

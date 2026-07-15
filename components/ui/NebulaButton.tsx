import { LinearGradient } from 'expo-linear-gradient';
import { MotiPressable } from 'moti/interactions';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, gradients } from '@/constants/theme';
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
        className={`flex-row items-center justify-center gap-2 ${className ?? ''}`}
        style={({ pressed }) => ({
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          ...styles.ghostButton,
        })}>
        {icon}
        <Text className="font-label uppercase tracking-[0.1em]" style={styles.ghostLabel}>
          {label}
        </Text>
      </Pressable>
    );
  }

  const palette = variant === 'cta' ? gradients.cta : gradients.nebula;
  const textColor = variant === 'cta' ? '#ffffff' : colors.onPrimary;

  const gradientButton = (
    <View style={styles.primaryShell}>
      <LinearGradient
        colors={[...palette]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}>
        <View pointerEvents="none" style={styles.primarySheen} />
        <View className={`flex-row items-center justify-center gap-3 ${className ?? ''}`} style={styles.primaryInner}>
          {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <Text
          className="font-label text-center uppercase tracking-[0.1em]"
          style={[styles.primaryLabel, { color: textColor }]}>
          {label}
        </Text>
        </View>
      </LinearGradient>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => ({
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        })}>
        {gradientButton}
      </Pressable>
    );
  }

  return (
    <MotiPressable
      animate={({ pressed }) => ({
        scale: pressed && !disabled ? 0.97 : 1,
        opacity: disabled ? 0.55 : 1,
      })}
      onPress={handlePress}
      disabled={disabled}>
      {gradientButton}
    </MotiPressable>
  );
}

const styles = StyleSheet.create({
  primaryShell: {
    borderRadius: 999,
    ...elevation.cta,
  },
  primaryGradient: {
    minHeight: 58,
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primarySheen: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 5,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    opacity: 0.42,
  },
  primaryInner: {
    minHeight: 58,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  primaryLabel: {
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  iconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ghostButton: {
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 26,
    paddingVertical: 15,
  },
  ghostLabel: {
    color: 'rgba(230,225,229,0.86)',
    fontSize: 12,
  },
});

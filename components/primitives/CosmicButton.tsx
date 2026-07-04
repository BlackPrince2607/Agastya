import { LinearGradient } from 'expo-linear-gradient';
import { MotiPressable } from 'moti/interactions';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { cosmicGradients } from '@/constants/theme';
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

function PrimaryButtonContent({
  label,
  gradient,
  icon,
}: {
  label: string;
  gradient: keyof Pick<typeof cosmicGradients, 'pulse' | 'nebulaMd3'>;
  icon?: ReactNode;
}) {
  return (
    <View style={styles.primaryShell}>
      <LinearGradient
        colors={[...cosmicGradients[gradient]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}>
        <View pointerEvents="none" style={styles.primarySheen} />
        <View style={styles.primaryInner} accessibilityRole="button">
          {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
          <Text className="text-center font-label uppercase tracking-[0.11em]" style={styles.primaryLabel}>
            {label}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export function CosmicButton({
  label,
  onPress,
  variant = 'primary',
  gradient = 'pulse',
  disabled,
  icon,
}: CosmicButtonProps) {
  const handlePress = () => {
    void triggerLightTap();
    onPress();
  };

  if (variant === 'ghost') {
    // Single Pressable — nested Pressable without onPress was swallowing taps (MotiPressable never fired).
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={handlePress}
        className="flex-row items-center justify-center gap-2"
        style={({ pressed }) => ({
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          ...styles.ghostButton,
        })}>
        <Text className="font-label uppercase tracking-[0.1em]" style={styles.ghostLabel}>
          {label}
        </Text>
      </Pressable>
    );
  }

  // MotiPressable can swallow taps on web — use plain Pressable there.
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
        <PrimaryButtonContent label={label} gradient={gradient} icon={icon} />
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
      <PrimaryButtonContent label={label} gradient={gradient} icon={icon} />
    </MotiPressable>
  );
}

const styles = StyleSheet.create({
  primaryShell: {
    borderRadius: 999,
    shadowColor: '#a855f7',
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  primaryLabel: {
    color: '#ffffff',
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

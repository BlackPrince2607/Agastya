import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { colors } from '@/constants/theme';

type CosmicTextFieldProps = ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Shows eye toggle for password fields. */
  showPasswordToggle?: boolean;
  /** Optional leading icon (Ionicons name). */
  leadingIcon?: ComponentProps<typeof Ionicons>['name'];
};

/**
 * Stitch-aligned text field — pill shape, label above, error/hint below.
 * Focus adds a subtle purple glow border.
 */
export function CosmicTextField({
  label,
  error,
  hint,
  showPasswordToggle,
  secureTextEntry,
  leadingIcon,
  className,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: CosmicTextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const isSecure = secureTextEntry && !revealed;
  const hasError = Boolean(error);
  const active = focused && !hasError;

  return (
    <View className="w-full gap-2">
      {label ? (
        <Text
          className={`ml-1 font-label text-[12px] uppercase tracking-[0.12em] ${
            active ? 'text-primary' : 'text-on-surface-variant'
          }`}
          maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      ) : null}

      <MotiView
        animate={{
          borderColor: hasError
            ? 'rgba(255,180,171,0.45)'
            : active
              ? 'rgba(168,85,247,0.55)'
              : 'rgba(255,255,255,0.1)',
          ...(active
            ? {
                shadowOpacity: 0.28,
                shadowRadius: 14,
              }
            : {
                shadowOpacity: 0,
                shadowRadius: 0,
              }),
        }}
        transition={{ type: 'timing', duration: 180 }}
        style={{
          borderRadius: 999,
          borderWidth: 1,
          backgroundColor: 'rgba(15,14,16,0.55)',
          shadowColor: colors.purple,
          shadowOffset: { width: 0, height: 4 },
          overflow: 'hidden',
        }}>
        <View className="relative w-full flex-row items-center">
          {leadingIcon ? (
            <View className="absolute left-4 z-10 h-full justify-center" pointerEvents="none">
              <Ionicons
                name={leadingIcon}
                size={20}
                color={active ? colors.primary : colors.onSurfaceVariant}
              />
            </View>
          ) : null}
          <TextInput
            {...rest}
            editable={editable}
            secureTextEntry={isSecure}
            placeholderTextColor={colors.placeholderDim}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            className={`min-h-[56px] flex-1 py-4 font-body text-[16px] leading-6 text-on-surface ${
              leadingIcon ? 'pl-12' : 'pl-6'
            } ${showPasswordToggle ? 'pr-14' : 'pr-6'} ${className ?? ''}`}
            accessibilityState={{ disabled: !editable }}
            maxFontSizeMultiplier={1.35}
          />
          {showPasswordToggle && secureTextEntry ? (
            <Pressable
              onPress={() => setRevealed((v) => !v)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-0 h-full justify-center">
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </Pressable>
          ) : null}
        </View>
      </MotiView>

      {error ? (
        <Text className="ml-1 font-body text-[13px] text-error" accessibilityRole="alert" maxFontSizeMultiplier={1.4}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="ml-1 font-body text-[13px] leading-5 text-on-surface-variant" maxFontSizeMultiplier={1.4}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

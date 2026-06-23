import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';

type CosmicTextFieldProps = ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Shows eye toggle for password fields. */
  showPasswordToggle?: boolean;
};

/**
 * Stitch-aligned text field — pill shape, label above, error/hint below.
 */
export function CosmicTextField({
  label,
  error,
  hint,
  showPasswordToggle,
  secureTextEntry,
  className,
  editable = true,
  ...rest
}: CosmicTextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isSecure = secureTextEntry && !revealed;
  const hasError = Boolean(error);

  return (
    <View className="w-full gap-2">
      {label ? (
        <Text className="ml-4 font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
          {label}
        </Text>
      ) : null}

      <View className="relative w-full">
        <TextInput
          {...rest}
          editable={editable}
          secureTextEntry={isSecure}
          placeholderTextColor={colors.placeholderDim}
          className={`rounded-pill border bg-surface-container-lowest/50 px-6 py-4 font-body text-[16px] text-on-surface ${
            hasError ? 'border-error/40' : 'border-white/10'
          } ${showPasswordToggle ? 'pr-14' : ''} ${className ?? ''}`}
          accessibilityState={{ disabled: !editable }}
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

      {error ? (
        <Text className="ml-4 font-body text-[13px] text-error" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text className="ml-4 font-body text-[13px] text-on-surface-variant">{hint}</Text>
      ) : null}
    </View>
  );
}

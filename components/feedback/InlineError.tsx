import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors } from '@/constants/theme';

type InlineErrorProps = {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
};

export function InlineError({
  message,
  onDismiss,
  onRetry,
  retryLabel = 'Try again',
}: InlineErrorProps) {
  return (
    <View
      className="w-full gap-2 rounded-2xl border border-error/30 bg-error-muted px-4 py-3"
      accessibilityRole="alert">
      <View className="w-full flex-row items-start gap-3">
        <Icon name="error_outline" size={20} color={colors.error} />
        <Text className="flex-1 font-body text-[14px] leading-5 text-error">{message}</Text>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error">
            <Icon name="close" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ) : null}
      </View>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          className="self-start pl-8 active:opacity-80"
          hitSlop={8}>
          <Text className="font-label text-[12px] uppercase tracking-[0.1em] text-error">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';

type InlineErrorProps = {
  message: string;
  onDismiss?: () => void;
};

export function InlineError({ message, onDismiss }: InlineErrorProps) {
  return (
    <View
      className="w-full flex-row items-start gap-3 rounded-2xl border border-error/30 bg-error-muted px-4 py-3"
      accessibilityRole="alert">
      <Icon name="error_outline" size={20} color="#ffb4ab" />
      <Text className="flex-1 font-body text-[14px] leading-5 text-error">{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss error">
          <Icon name="close" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      ) : null}
    </View>
  );
}

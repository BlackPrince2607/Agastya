import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type InlineErrorProps = {
  message: string;
  onDismiss?: () => void;
};

export function InlineError({ message, onDismiss }: InlineErrorProps) {
  return (
    <View
      className="w-full flex-row items-start gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3"
      accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={20} color="#f87171" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-[14px] leading-5 text-red-100">{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss error">
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      ) : null}
    </View>
  );
}

import { ActivityIndicator, Text, View } from 'react-native';

type LoadingBlockProps = {
  message?: string;
  compact?: boolean;
};

export function LoadingBlock({ message = 'Loading…', compact }: LoadingBlockProps) {
  return (
    <View
      className={`w-full flex-row items-center justify-center gap-3 ${compact ? 'py-3' : 'py-8'}`}
      accessibilityRole="progressbar"
      accessibilityLabel={message}>
      <ActivityIndicator color="#a855f7" />
      <Text className="font-inter text-[14px] text-md-on-surface-variant">{message}</Text>
    </View>
  );
}

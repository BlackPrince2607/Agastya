import { ActivityIndicator, Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { colors } from '@/constants/theme';

type LoadingBlockProps = {
  message?: string;
  compact?: boolean;
  /** Prefer shimmer skeleton over spinner for content placeholders. */
  variant?: 'spinner' | 'skeleton';
};

export function LoadingBlock({ message = 'Loading…', compact, variant = 'spinner' }: LoadingBlockProps) {
  if (variant === 'skeleton') {
    return (
      <View
        className={`w-full gap-3 ${compact ? 'py-3' : 'py-8'}`}
        accessibilityRole="progressbar"
        accessibilityLabel={message}>
        <SkeletonBlock height={18} width="42%" />
        <SkeletonBlock height={14} width="88%" />
        <SkeletonBlock height={14} width="72%" />
        {message ? (
          <Text className="mt-1 font-body text-[13px] text-on-surface-variant">{message}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className={`w-full flex-row items-center justify-center gap-3 ${compact ? 'py-3' : 'py-8'}`}
      accessibilityRole="progressbar"
      accessibilityLabel={message}>
      <ActivityIndicator color={colors.purple} />
      <Text className="font-body text-[14px] text-on-surface-variant">{message}</Text>
    </View>
  );
}

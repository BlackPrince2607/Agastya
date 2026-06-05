import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { CosmicButton } from '@/components/primitives/CosmicButton';

type EmptyStateProps = {
  icon?: ComponentProps<typeof FontAwesome>['name'];
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'inbox', title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="w-full items-center gap-4 py-8" accessibilityRole="text">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
        <FontAwesome name={icon} size={26} color="rgba(255,255,255,0.45)" />
      </View>
      <Text className="text-center font-inter-medium text-[17px] text-mist">{title}</Text>
      <Text className="max-w-[300px] text-center text-[14px] leading-6 text-md-on-surface-variant">{body}</Text>
      {actionLabel && onAction ? (
        <CosmicButton gradient="nebulaMd3" label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

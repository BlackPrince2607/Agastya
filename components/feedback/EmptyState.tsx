import { Text, View } from 'react-native';

import { CosmicButton } from '@/components/primitives/CosmicButton';
import { Icon, type IconName } from '@/components/ui';

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'auto_awesome', title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="w-full items-center gap-5 py-10" accessibilityRole="text">
      <View className="h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
        <Icon name={icon} size={28} color="rgba(232,225,229,0.45)" />
      </View>
      <View className="gap-2 px-4">
        <Text className="text-center font-headline-md text-[18px] text-on-surface">{title}</Text>
        <Text className="max-w-[300px] text-center font-body text-[14px] leading-6 text-on-surface-variant">
          {body}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <CosmicButton gradient="nebulaMd3" label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

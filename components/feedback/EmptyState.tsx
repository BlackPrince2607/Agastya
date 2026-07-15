import { Text, View } from 'react-native';

import { AnimatedIcon } from '@/components/ui/AnimatedIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { IconName } from '@/components/ui/Icon';

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'auto_awesome', title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="w-full items-center gap-6 py-12" accessibilityRole="text">
      <AnimatedIcon name={icon} size={30} float pulse />
      <View className="gap-2.5 px-4">
        <Text className="text-center font-headline-md text-[20px] leading-7 text-on-surface">{title}</Text>
        <Text className="max-w-[320px] text-center font-body text-[15px] leading-6 text-on-surface-variant">
          {body}
        </Text>
      </View>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

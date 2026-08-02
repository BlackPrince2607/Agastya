import { Text, View } from 'react-native';

import { Icon, PressableScale, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';

type ProfileActionCardProps = {
  title: string;
  icon: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Compact action segment for the Profile hero bar — icon + label in one row.
 */
export function ProfileActionCard({
  title,
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: ProfileActionCardProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={{ width: '100%' }}>
      <View
        className="w-full flex-row items-center justify-center gap-2"
        style={{ paddingHorizontal: 12, paddingVertical: 14 }}>
        <View
          className="h-8 w-8 items-center justify-center rounded-xl border border-white/10"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Icon name={icon} size={17} color={colors.primary} />
        </View>
        <Text
          className="shrink font-body-medium text-[14px] text-on-surface"
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

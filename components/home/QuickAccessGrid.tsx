import { Text, View } from 'react-native';

import { GlassCard, Icon, type IconName } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { MotiView } from '@/components/moti/MotiView';
import { colors, elevation, radii } from '@/constants/theme';

export type QuickAccessItem = {
  action: string;
  label: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  accessibilityHint?: string;
};

type QuickAccessGridProps = {
  items: QuickAccessItem[];
  tileMinHeight?: number;
  gap?: number;
};

/**
 * Home quick-access tiles with larger icons, subtitles, and press scale.
 */
export function QuickAccessGrid({ items, tileMinHeight = 128, gap = 12 }: QuickAccessGridProps) {
  return (
    <View className="w-full flex-row flex-wrap justify-between" style={{ rowGap: gap }}>
      {items.map((item, index) => (
        <MotiView
          key={item.action}
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 420, delay: 80 + index * 50 }}
          style={{ width: '48%' }}>
          <PressableScale
            onPress={item.onPress}
            accessibilityLabel={item.label}
            accessibilityHint={item.accessibilityHint ?? item.subtitle}
            scaleTo={0.97}>
            <GlassCard
              className="w-full"
              innerClassName="items-start justify-between gap-3 px-4 py-4"
              style={{ minHeight: tileMinHeight }}>
              <View
                className="h-14 w-14 items-center justify-center border border-white/10"
                style={{
                  borderRadius: radii.md,
                  backgroundColor: 'rgba(168,85,247,0.18)',
                  ...elevation.card,
                  shadowColor: colors.purple,
                }}>
                <Icon name={item.icon} size={28} color={colors.purple} />
              </View>
              <View className="w-full gap-1">
                <Text className="font-headline-md text-[16px] leading-5 text-on-surface" numberOfLines={1}>
                  {item.label}
                </Text>
                <Text className="font-body text-[12px] leading-4 text-on-surface-variant" numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
            </GlassCard>
          </PressableScale>
        </MotiView>
      ))}
    </View>
  );
}

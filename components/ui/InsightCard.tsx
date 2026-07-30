import { Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors } from '@/constants/theme';

type InsightCardProps = {
  eyebrow?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  onPress?: () => void;
  /** Show floating flare icon (default true). */
  animatedIcon?: boolean;
};

/**
 * Focal daily insight card — glass surface, purple glow, press elevation.
 */
export function InsightCard({
  eyebrow = "Today's Insight",
  title,
  body,
  ctaLabel = 'Read Full Reading',
  onPress,
  animatedIcon = true,
}: InsightCardProps) {
  const content = (
    <GlassCard glow className="w-full" innerClassName="gap-4 p-5">
      <View className="relative w-full">
        {animatedIcon ? (
          <MotiView
            className="absolute right-0 top-0 z-10"
            from={{ translateY: 0 }}
            animate={{ translateY: -3 }}
            transition={{ type: 'timing', duration: 2200, loop: true }}>
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(168,85,247,0.22)' }}>
              <Icon name="flare" size={24} color="rgba(255,255,255,0.72)" />
            </View>
          </MotiView>
        ) : null}

        <View className={`w-full gap-3 ${animatedIcon ? 'pr-14' : ''}`}>
          <View className="flex-row items-center gap-2">
            <Icon name="psychology" size={16} color={colors.purple} />
            <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-primary">{eyebrow}</Text>
          </View>
          <Text className="font-headline text-[24px] leading-8 text-on-surface" accessibilityRole="header">
            {title}
          </Text>
          <Text className="font-body text-[15px] leading-6 text-on-surface-variant">{body}</Text>
        </View>
      </View>

      {onPress ? (
        <View className="flex-row items-center gap-1.5">
          <Text className="font-label text-[13px] tracking-[0.04em] text-primary">{ctaLabel}</Text>
          <Icon name="arrow_forward" size={16} color={colors.primary} />
        </View>
      ) : null}
    </GlassCard>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${title}. ${ctaLabel}`}
      accessibilityHint="Opens your palm reading"
      scaleTo={0.985}
      style={{ width: '100%' }}>
      {content}
    </PressableScale>
  );
}

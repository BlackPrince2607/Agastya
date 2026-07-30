import { Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors } from '@/constants/theme';

type ProgressCardProps = {
  title?: string;
  completed: number;
  total: number;
  footnote?: string;
  /** Optional streak number shown on the right. */
  streak?: number;
  /** 0–100 progress; derived from completed/total when omitted. */
  value?: number;
};

/**
 * Daily journey progress — rituals completed + animated nebula bar.
 */
export function ProgressCard({
  title = "Today's Journey",
  completed,
  total,
  footnote = "Complete all rituals to unlock today's wisdom.",
  streak,
  value,
}: ProgressCardProps) {
  const safeTotal = Math.max(0, total);
  const progress =
    value ?? (safeTotal > 0 ? Math.round((Math.min(completed, safeTotal) / safeTotal) * 100) : 0);
  const countLabel =
    safeTotal > 0 ? `${completed} / ${safeTotal} Rituals Completed` : 'Begin your rituals';

  return (
    <GlassCard className="w-full" innerClassName="gap-4 p-5">
      <View className="flex-row items-start gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple/20">
          <Icon name="local_fire_department" size={24} color={colors.purple} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-headline-md text-[18px] leading-6 text-on-surface">{title}</Text>
          <Text className="font-body-medium text-[15px] leading-5 text-on-surface">{countLabel}</Text>
          <Text className="mt-0.5 font-body text-[13px] leading-5 text-on-surface-variant">{footnote}</Text>
        </View>
        {typeof streak === 'number' && streak > 0 ? (
          <Text className="font-headline-md text-[22px] text-primary">{streak}</Text>
        ) : null}
      </View>
      <ProgressBar value={progress} height={10} palette="progress" />
    </GlassCard>
  );
}

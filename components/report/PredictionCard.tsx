import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GlassCard, Icon, type IconName } from '@/components/ui';
import type { PredictionCategory } from '@/types/predictions';

const CATEGORY_META: Record<
  PredictionCategory,
  { label: string; icon: IconName; tint: string; gradient: readonly [string, string, string] }
> = {
  career: {
    label: 'Career',
    icon: 'work',
    tint: '#60a5fa',
    gradient: ['rgba(96,165,250,0.18)', 'rgba(96,165,250,0.06)', 'rgba(15,14,16,0)'],
  },
  love: {
    label: 'Love',
    icon: 'favorite',
    tint: '#f472b6',
    gradient: ['rgba(244,114,182,0.20)', 'rgba(232,121,249,0.08)', 'rgba(15,14,16,0)'],
  },
  money: {
    label: 'Money',
    icon: 'payments',
    tint: '#fbbf24',
    gradient: ['rgba(251,191,36,0.18)', 'rgba(251,191,36,0.06)', 'rgba(15,14,16,0)'],
  },
  growth: {
    label: 'Personal Growth',
    icon: 'eco',
    tint: '#c084fc',
    gradient: ['rgba(192,132,252,0.20)', 'rgba(168,85,247,0.08)', 'rgba(15,14,16,0)'],
  },
};

type PredictionCardProps = {
  category: PredictionCategory;
  headline: string;
  detail: string;
  locked?: boolean;
};

export function PredictionCard({ category, headline, detail, locked }: PredictionCardProps) {
  const meta = CATEGORY_META[category];

  return (
    <GlassCard className="w-full overflow-hidden p-0">
      <LinearGradient
        colors={[...meta.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20, gap: 8 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <View
              className="h-10 w-10 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${meta.tint}22` }}>
              <Icon name={meta.icon} size={20} color={meta.tint} />
            </View>
            <Text className="font-label text-[12px] uppercase tracking-[0.14em]" style={{ color: meta.tint }}>
              {meta.label}
            </Text>
          </View>
          {locked ? <Icon name="lock" size={16} color="rgba(232,225,229,0.4)" /> : null}
        </View>
        <Text className="font-headline-md text-[20px] leading-7 text-on-surface">{headline}</Text>
        <Text
          className="font-body text-[14px] leading-6 text-on-surface-variant"
          numberOfLines={locked ? 1 : undefined}
          style={locked ? { opacity: 0.5 } : undefined}>
          {locked ? 'Unlock predictions to reveal this insight.' : detail}
        </Text>
      </LinearGradient>
    </GlassCard>
  );
}

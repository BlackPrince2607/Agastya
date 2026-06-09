import { Text, View } from 'react-native';

import { GlassCard, Icon, type IconName } from '@/components/ui';
import type { PredictionCategory } from '@/types/predictions';

const CATEGORY_META: Record<PredictionCategory, { label: string; icon: IconName; tint: string }> = {
  career: { label: 'Career', icon: 'work', tint: '#d3beeb' },
  love: { label: 'Love', icon: 'favorite', tint: '#e879f9' },
  money: { label: 'Money', icon: 'payments', tint: '#22d3ee' },
  growth: { label: 'Personal Growth', icon: 'eco', tint: '#4ade80' },
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
    <GlassCard className="w-full gap-2 p-5" style={{ borderLeftWidth: 3, borderLeftColor: meta.tint }}>
      <View className="flex-row items-center gap-2">
        <Icon name={meta.icon} size={18} color={meta.tint} />
        <Text className="font-label text-[12px] uppercase tracking-[0.14em]" style={{ color: meta.tint }}>
          {meta.label}
        </Text>
        {locked ? <Icon name="lock" size={14} color="rgba(232,225,229,0.4)" /> : null}
      </View>
      <Text className="font-headline-md text-[18px] text-on-surface">{headline}</Text>
      <Text
        className="font-body text-[14px] leading-6 text-on-surface-variant"
        numberOfLines={locked ? 1 : undefined}
        style={locked ? { opacity: 0.5 } : undefined}>
        {locked ? 'Unlock predictions to reveal this insight.' : detail}
      </Text>
    </GlassCard>
  );
}

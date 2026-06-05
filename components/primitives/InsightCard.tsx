import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import type { InsightSection } from '@/types/report';

import { GlowCard } from './GlowCard';

type InsightCardProps = PropsWithChildren<{
  insight: InsightSection;
}>;

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <GlowCard className="w-full gap-2 py-4">
      <Text className="font-inter-medium text-[13px] uppercase tracking-wide text-stitch-signal">Daily insight</Text>
      <Text className="font-inter-medium text-[17px] text-mist">{insight.title}</Text>
      <Text className="text-[14px] leading-6 text-md-on-surface-variant" numberOfLines={4}>
        {insight.body}
      </Text>
    </GlowCard>
  );
}

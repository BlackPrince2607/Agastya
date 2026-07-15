import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import type { InsightSection } from '@/types/report';

type ReportInsightCardProps = PropsWithChildren<{
  insight: InsightSection;
}>;

/**
 * Report section insight — glass card aligned with the global design system.
 * Prefer this name over the legacy `InsightCard` alias to avoid clashing with
 * `@/components/ui/InsightCard` (home daily insight).
 */
export function ReportInsightCard({ insight }: ReportInsightCardProps) {
  return (
    <GlassCard className="w-full p-5" muted innerClassName="gap-2">
      <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-primary">Insight</Text>
      <Text className="font-headline-md text-[18px] leading-6 text-on-surface">{insight.title}</Text>
      <Text className="font-body text-[15px] leading-6 text-on-surface-variant" numberOfLines={4}>
        {insight.body}
      </Text>
    </GlassCard>
  );
}

/** @deprecated Use ReportInsightCard — kept for existing report/preview imports. */
export const InsightCard = ReportInsightCard;

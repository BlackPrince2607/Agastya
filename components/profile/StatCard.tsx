import { memo } from 'react';
import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';

export type StatCardProps = {
  icon: IconName;
  label: string;
  value: string | number;
  /** Right edge divider inside the 2×2 grid. */
  borderRight?: boolean;
  /** Bottom edge divider inside the 2×2 grid. */
  borderBottom?: boolean;
  accessibilityLabel?: string;
};

const CELL_MIN_HEIGHT = 88;

/**
 * Uniform stats cell — fixed height for a cohesive 2×2 grid.
 * Parent supplies the shared shell via StatsGrid.
 */
function StatCardComponent({
  icon,
  label,
  value,
  borderRight,
  borderBottom,
  accessibilityLabel,
}: StatCardProps) {
  return (
    <View
      className="min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3"
      style={{
        minHeight: CELL_MIN_HEIGHT,
        borderRightWidth: borderRight ? 1 : 0,
        borderBottomWidth: borderBottom ? 1 : 0,
        borderRightColor: 'rgba(255,255,255,0.06)',
        borderBottomColor: 'rgba(255,255,255,0.06)',
      }}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}>
      <Icon name={icon} size={16} color={colors.primary} />
      <Text
        className="font-headline-md text-[20px] leading-6 text-on-surface"
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}>
        {value}
      </Text>
      <Text
        className="text-center font-body text-[11px] leading-4 text-on-surface-variant"
        maxFontSizeMultiplier={1.35}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const StatCard = memo(StatCardComponent);

type StatsGridItem = {
  icon: IconName;
  label: string;
  value: string | number;
  accessibilityLabel?: string;
};

type StatsGridProps = {
  items: [StatsGridItem, StatsGridItem, StatsGridItem, StatsGridItem];
};

/**
 * Single muted card containing four equal cells — Apple Settings / Health style.
 */
export function StatsGrid({ items }: StatsGridProps) {
  const [a, b, c, d] = items;
  return (
    <View className="w-full overflow-hidden rounded-glass border border-white/10 bg-white/[0.04]">
      <View className="flex-row">
        <StatCard {...a} borderRight borderBottom />
        <StatCard {...b} borderBottom />
      </View>
      <View className="flex-row">
        <StatCard {...c} borderRight />
        <StatCard {...d} />
      </View>
    </View>
  );
}

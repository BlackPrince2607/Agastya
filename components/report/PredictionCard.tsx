import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard, Icon, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { PredictionBeat, PredictionCategory } from '@/types/predictions';

const CATEGORY_META: Record<
  PredictionCategory,
  { label: string; icon: IconName; tint: string; gradient: readonly [string, string, string] }
> = {
  career: {
    label: 'Career',
    icon: 'work',
    tint: colors.career,
    gradient: ['rgba(96,165,250,0.18)', 'rgba(96,165,250,0.06)', 'rgba(15,14,16,0)'],
  },
  love: {
    label: 'Love',
    icon: 'favorite',
    tint: colors.love,
    gradient: ['rgba(244,114,182,0.20)', 'rgba(232,121,249,0.08)', 'rgba(15,14,16,0)'],
  },
  money: {
    label: 'Money',
    icon: 'payments',
    tint: colors.money,
    gradient: ['rgba(251,191,36,0.18)', 'rgba(251,191,36,0.06)', 'rgba(15,14,16,0)'],
  },
  growth: {
    label: 'Personal Growth',
    icon: 'eco',
    tint: colors.growth,
    gradient: ['rgba(192,132,252,0.20)', 'rgba(168,85,247,0.08)', 'rgba(15,14,16,0)'],
  },
};

type PredictionCardProps = {
  category: PredictionCategory;
  headline: string;
  detail: string;
  insight?: string | null;
  beats?: PredictionBeat[];
  locked?: boolean;
  expanded?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onLockedPress?: () => void;
};

export function PredictionCard({
  category,
  headline,
  detail,
  insight,
  beats,
  locked,
  expanded = false,
  onOpen,
  onClose,
  onLockedPress,
}: PredictionCardProps) {
  const meta = CATEGORY_META[category];
  const teaserHeadline = `Unlock your ${meta.label.toLowerCase()} insight`;
  const body = (insight?.trim() || detail).trim();

  const toggle = () => {
    if (locked) {
      onLockedPress?.();
      return;
    }
    if (expanded) onClose?.();
    else onOpen?.();
  };

  return (
    <Pressable
      onPress={toggle}
      delayPressIn={0}
      accessibilityRole="button"
      accessibilityState={{ expanded: expanded && !locked, disabled: false }}
      accessibilityLabel={
        locked
          ? `${meta.label} prediction locked. ${teaserHeadline}`
          : `${meta.label}. ${headline}. Tap to ${expanded ? 'collapse' : 'read the full timeline'}`
      }>
      <GlassCard className="w-full overflow-hidden p-0" glow={expanded && !locked}>
        <LinearGradient
          colors={[...meta.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20, gap: 10 }}>
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
            {locked ? (
              <Icon name="lock" size={16} color="rgba(232,225,229,0.4)" />
            ) : (
              <Icon name={expanded ? 'expand_less' : 'expand_more'} size={22} color={meta.tint} />
            )}
          </View>
          {locked ? (
            <Text className="font-headline-md text-[20px] leading-7 text-on-surface-variant">{teaserHeadline}</Text>
          ) : (
            <Text className="font-headline-md text-[20px] leading-7 text-on-surface">{headline}</Text>
          )}
          {locked ? (
            <Text className="font-body text-[14px] leading-6 text-on-surface-variant" style={{ opacity: 0.5 }}>
              Tap to unlock longer-range forecasts.
            </Text>
          ) : (
            <Text
              className="font-body text-[14px] leading-6 text-on-surface-variant"
              numberOfLines={expanded ? undefined : 3}>
              {expanded ? body : detail}
            </Text>
          )}
          {expanded && !locked && beats && beats.length > 0 ? (
            <View className="mt-1 gap-2.5">
              {beats.map((beat) => (
                <View key={beat.label} className="gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                  <Text className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: meta.tint }}>
                    {beat.label}
                  </Text>
                  <Text className="font-body text-[13px] leading-5 text-on-surface-variant">{beat.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {!locked && !expanded ? (
            <Text className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: meta.tint }}>
              Tap to expand
            </Text>
          ) : null}
        </LinearGradient>
      </GlassCard>
    </Pressable>
  );
}

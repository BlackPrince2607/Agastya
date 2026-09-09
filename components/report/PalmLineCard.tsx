import { Pressable, Text, View } from 'react-native';

import { GlassCard, Icon, ProgressBar } from '@/components/ui';
import { colors } from '@/constants/theme';

type PalmLineCardProps = {
  lineKey?: string;
  lineName: string;
  descriptor: string;
  interpretation: string;
  score: number;
  length?: string;
  depth?: string;
  breaks?: number;
  notes?: string;
  unclear?: boolean;
  rekhaName?: string;
  expanded?: boolean;
  selected?: boolean;
  onPress?: () => void;
};

const LINE_TINTS: Record<string, string> = {
  'Life Line': colors.purple,
  'Life Line · Jeevan Rekha': colors.purple,
  'Heart Line': colors.love,
  'Heart Line · Hridaya Rekha': colors.love,
  'Head Line': colors.cyan,
  'Head Line · Mastishka Rekha': colors.cyan,
  'Fate Line': colors.primary,
  'Fate Line · Bhagya Rekha': colors.primary,
  'Sun Line': '#e8b84a',
  'Sun Line · Surya Rekha': '#e8b84a',
  'Marriage Line': '#f472b6',
  'Marriage Line · Vivah Rekha': '#f472b6',
};

export function PalmLineCard({
  lineName,
  descriptor,
  interpretation,
  score,
  length,
  depth,
  breaks,
  notes,
  unclear,
  expanded = false,
  selected = false,
  onPress,
}: PalmLineCardProps) {
  const tint = LINE_TINTS[lineName] ?? colors.primary;
  const hasMetrics = Boolean(length || depth || breaks != null);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded, selected }}
      accessibilityLabel={`${lineName}. ${descriptor}. Tap to ${expanded ? 'collapse' : 'read full insight'}`}>
      <GlassCard
        className="w-full p-5"
        glow={expanded || selected}
        muted={!expanded && !selected}>
        <View className="flex-1 gap-2.5">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-headline-md text-[17px] leading-6 text-on-surface">{lineName}</Text>
            <View className="flex-row items-center gap-2">
              {unclear ? (
                <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                  Not marked
                </Text>
              ) : (
                <Text className="font-label text-[22px] font-bold" style={{ color: tint }}>
                  {score}%
                </Text>
              )}
              <Icon
                name={expanded ? 'expand_less' : 'expand_more'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </View>
          </View>
          <Text className="font-label text-[11px] uppercase tracking-[0.14em]" style={{ color: tint }}>
            {descriptor}
          </Text>
          {expanded ? (
            <>
              {hasMetrics && !unclear ? (
                <Text className="font-label text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                  {[
                    length ? `Length: ${length}` : null,
                    depth ? `Depth: ${depth}` : null,
                    breaks != null ? `Breaks: ${breaks}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
              <Text className="font-body text-[15px] leading-6 text-on-surface-variant">{interpretation}</Text>
              {notes?.trim() && notes.trim() !== interpretation ? (
                <Text className="font-body text-[13px] leading-5 text-on-surface-variant/80">{notes}</Text>
              ) : null}
              {!unclear ? (
                <View className="mt-1 gap-1">
                  <ProgressBar value={score} height={8} palette="progress" />
                </View>
              ) : null}
            </>
          ) : (
            <Text className="font-body text-[14px] leading-6 text-on-surface-variant" numberOfLines={2}>
              {interpretation}
            </Text>
          )}
        </View>
      </GlassCard>
    </Pressable>
  );
}

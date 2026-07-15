import { Text, View } from 'react-native';

import { GlassCard, ProgressBar } from '@/components/ui';
import { lineKindFromName, PalmLineVisual } from '@/components/report/PalmLineVisual';
import { colors } from '@/constants/theme';

type PalmLineCardProps = {
  lineName: string;
  descriptor: string;
  interpretation: string;
  score: number;
  length?: string;
  depth?: string;
  breaks?: number;
  notes?: string;
};

const LINE_TINTS: Record<string, string> = {
  'Life Line': colors.purple,
  'Heart Line': colors.love,
  'Head Line': colors.cyan,
};

/** Stitch detailed-report line card: interpretation, score bar, and highlighted palm visual. */
export function PalmLineCard({
  lineName,
  descriptor,
  interpretation,
  score,
  length,
  depth,
  breaks,
  notes,
}: PalmLineCardProps) {
  const tint = LINE_TINTS[lineName] ?? colors.primary;
  const lineKind = lineKindFromName(lineName);
  const hasMetrics = Boolean(length || depth || breaks != null);

  return (
    <GlassCard className="w-full p-5">
      <View className="flex-row gap-4">
        <View className="flex-1 gap-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-headline-md text-[20px] text-on-surface">{lineName}</Text>
            <Text className="font-label text-[22px] font-bold" style={{ color: tint }}>
              {score}%
            </Text>
          </View>
          <Text className="font-label text-[11px] uppercase tracking-[0.14em]" style={{ color: tint }}>
            {descriptor}
          </Text>
          {hasMetrics ? (
            <Text className="font-label text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
              {[length ? `Length: ${length}` : null, depth ? `Depth: ${depth}` : null, breaks != null ? `Breaks: ${breaks}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <Text className="font-body text-[15px] leading-6 text-on-surface-variant">{interpretation}</Text>
          {notes?.trim() && notes.trim() !== interpretation ? (
            <Text className="font-body text-[13px] leading-5 text-on-surface-variant/80">{notes}</Text>
          ) : null}
          <View className="mt-1 gap-1">
            <ProgressBar value={score} height={8} palette="progress" />
          </View>
        </View>
        <PalmLineVisual line={lineKind} size={96} />
      </View>
    </GlassCard>
  );
}

import { Text, View } from 'react-native';

import { GlassCard, ProgressBar } from '@/components/ui';
import { lineKindFromName, PalmLineVisual } from '@/components/report/PalmLineVisual';

type PalmLineCardProps = {
  lineName: string;
  descriptor: string;
  interpretation: string;
  score: number;
};

const LINE_TINTS: Record<string, string> = {
  'Life Line': '#a855f7',
  'Heart Line': '#f472b6',
  'Head Line': '#22d3ee',
};

/** Stitch detailed-report line card: interpretation, score bar, and highlighted palm visual. */
export function PalmLineCard({ lineName, descriptor, interpretation, score }: PalmLineCardProps) {
  const tint = LINE_TINTS[lineName] ?? '#d3beeb';
  const lineKind = lineKindFromName(lineName);

  return (
    <GlassCard className="w-full p-5">
      <View className="flex-row gap-4">
        <View className="flex-1 gap-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-headline-md text-[20px] text-on-surface">{lineName}</Text>
            <Text className="font-space-grotesk text-[22px] font-bold" style={{ color: tint }}>
              {score}%
            </Text>
          </View>
          <Text className="font-label text-[11px] uppercase tracking-[0.14em]" style={{ color: tint }}>
            {descriptor}
          </Text>
          <Text className="font-body text-[14px] leading-6 text-on-surface-variant">{interpretation}</Text>
          <View className="mt-1 gap-1">
            <ProgressBar value={score} height={8} palette="progress" />
          </View>
        </View>
        <PalmLineVisual line={lineKind} size={96} />
      </View>
    </GlassCard>
  );
}

import { Text, View } from 'react-native';

import { GlassCard, ProgressBar } from '@/components/ui';

type PalmLineCardProps = {
  lineName: string;
  descriptor: string;
  interpretation: string;
  score: number;
};

/** Stitch detailed-report line card: name, interpretation, score bar. */
export function PalmLineCard({ lineName, descriptor, interpretation, score }: PalmLineCardProps) {
  return (
    <GlassCard className="w-full gap-3 p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-headline-md text-[20px] text-on-surface">{lineName}</Text>
        <Text className="font-label text-[11px] uppercase tracking-[0.14em] text-primary">{descriptor}</Text>
      </View>
      <Text className="font-body text-[14px] leading-6 text-on-surface-variant">{interpretation}</Text>
      <View className="mt-1 gap-1.5">
        <ProgressBar value={score} />
        <Text className="self-end font-label text-[12px] text-on-surface-variant">{score}%</Text>
      </View>
    </GlassCard>
  );
}

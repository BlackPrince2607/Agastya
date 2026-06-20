import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { gradients } from '@/constants/theme';

type MetricBarProps = {
  label: string;
  pct: number;
};

export function MetricBar({ label, pct }: MetricBarProps) {
  const clamped = Math.round(Math.min(100, Math.max(0, pct)));
  return (
    <View className="w-full gap-2">
      <View className="w-full flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 font-body text-[15px] text-on-surface">{label}</Text>
        <Text className="shrink-0 font-space-grotesk text-[14px] font-semibold text-primary">{clamped}%</Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <LinearGradient
          colors={[...gradients.progress]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: `${clamped}%`, height: '100%', borderRadius: 999 }}
        />
      </View>
    </View>
  );
}

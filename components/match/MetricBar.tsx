import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { cosmicGradients } from '@/constants/theme';

type MetricBarProps = {
  label: string;
  pct: number;
};

export function MetricBar({ label, pct }: MetricBarProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter text-[14px] text-mist">{label}</Text>
        <Text className="font-space-grotesk text-[13px] font-semibold text-stitch-signal">{clamped}%</Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <LinearGradient
          colors={[cosmicGradients.pulse[0], '#d392f6', '#f472b6']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: `${clamped}%`, height: '100%', borderRadius: 999 }}
        />
      </View>
    </View>
  );
}

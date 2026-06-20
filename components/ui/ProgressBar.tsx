import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { View } from 'react-native';

import { gradients } from '@/constants/theme';

type ProgressBarProps = {
  /** 0–100 */
  value: number;
  /** Track height in px. */
  height?: number;
  /** Gradient palette key. */
  palette?: keyof typeof gradients;
};

/** Thin nebula-filled progress track with a leading glow point. */
export function ProgressBar({ value, height = 6, palette = 'progress' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const colors = palette in gradients ? gradients[palette as keyof typeof gradients] : gradients.nebula;

  return (
    <View
      className="w-full overflow-hidden rounded-pill bg-white/10"
      style={{ height }}>
      <MotiView
        from={{ width: '0%' }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ height: '100%' }}>
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </MotiView>
    </View>
  );
}

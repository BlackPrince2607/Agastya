import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { View, Text } from 'react-native';

import { colors } from '@/constants/theme';
import { METRIC_GRADIENTS, metricKeyFromLabel } from '@/utils/lifeMetrics';
import type { MetricKey } from '@/types/report';

type MetricDonutProps = {
  label: string;
  value: number;
  size?: number;
  /** Explicit pillar — otherwise inferred from label. */
  metricKey?: MetricKey;
  strokeGradient?: readonly [string, string];
};

export function MetricDonut({
  label,
  value,
  size = 86,
  metricKey,
  strokeGradient,
}: MetricDonutProps) {
  const key = metricKey ?? metricKeyFromLabel(label);
  const gradient =
    strokeGradient ?? (key ? METRIC_GRADIENTS[key] : ([colors.cyan, colors.purple] as const));

  // Values are normalized upstream; still clamp for SVG safety.
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 8;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const slug = label.replace(/\s+/g, '-').replace(/%/g, 'pct');

  return (
    <View className="items-center gap-2">
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="rgba(255,255,255,0.03)"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#metric-${slug}-${clamped})`}
            strokeWidth={stroke}
            strokeDasharray={`${(clamped / 100) * c} ${c}`}
            strokeLinecap="round"
            fill="none"
          />
          <Defs>
            <LinearGradient id={`metric-${slug}-${clamped}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={gradient[0]} />
              <Stop offset="100%" stopColor={gradient[1]} />
            </LinearGradient>
          </Defs>
        </Svg>
        <Text className="absolute text-[15px] font-semibold tracking-tight text-on-surface">{clamped}%</Text>
      </View>
      <Text className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/52">
        {label}
      </Text>
    </View>
  );
}

import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

type ProgressRingProps = {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
};

/** Teal→lavender SVG progress ring with fraction in the center. */
export function ProgressRing({ done, total, size = 140, stroke = 12 }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  const dashOffset = circumference * (1 - frac);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#22d3ee" />
            <Stop offset="1" stopColor="#d3beeb" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute items-center">
        <Text className="font-headline text-[28px] text-on-surface">
          {done}/{total}
        </Text>
        <Text className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Completed</Text>
      </MotiView>
    </View>
  );
}

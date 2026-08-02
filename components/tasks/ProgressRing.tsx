import { useEffect, useId } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
};

/** Teal→lavender SVG progress ring with fraction in the center. */
export function ProgressRing({ done, total, size = 112, stroke = 8 }: ProgressRingProps) {
  const gradId = useId().replace(/:/g, '');
  const pad = stroke / 2;
  const canvas = size + pad * 2;
  const center = canvas / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetFrac = total > 0 ? Math.min(1, done / total) : 0;

  const progress = useSharedValue(targetFrac);

  useEffect(() => {
    progress.value = withTiming(targetFrac, { duration: 650 });
  }, [targetFrac, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${progress.value * circumference} ${circumference}`,
  }));

  return (
    <View style={{ width: canvas, height: canvas, overflow: 'visible' }} className="items-center justify-center">
      <Svg width={canvas} height={canvas} viewBox={`0 0 ${canvas} ${canvas}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#22d3ee" />
            <Stop offset="1" stopColor="#d3beeb" />
          </LinearGradient>
        </Defs>
        <G transform={`rotate(-90 ${center} ${center})`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            animatedProps={animatedProps}
          />
        </G>
      </Svg>
      <View className="absolute items-center justify-center">
        <Text className="font-headline text-[28px] text-on-surface">
          {done}/{total}
        </Text>
        <Text className="font-label text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">Completed</Text>
      </View>
    </View>
  );
}

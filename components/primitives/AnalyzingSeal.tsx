import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, cosmicGradients } from '@/constants/theme';

type Props = {
  diameter?: number;
  hideCenterGlyph?: boolean;
  /** 0–100 ring fill; drives the arc from empty → full. */
  progress?: number;
};

/** Circular progress seal — arc fills 0 → 100 with `progress`. */
export function AnalyzingSeal({ diameter = 220, hideCenterGlyph, progress = 0 }: Props) {
  const gid = `sealGlow-${diameter}`;
  const thickness = 6;
  const r = diameter / 2 - thickness / 2;
  const c = Math.PI * 2 * r;
  const pct = Math.min(100, Math.max(0, progress));
  // Empty at 0, full ring at 100 (draw from top, clockwise).
  const dashOffset = c * (1 - pct / 100);

  return (
    <View style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={diameter} height={diameter}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={cosmicGradients.pulse[0]} />
            <Stop offset="100%" stopColor={colors.cyan} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={thickness}
          fill="rgba(255,255,255,0.02)"
        />
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={r}
          stroke={`url(#${gid})`}
          strokeWidth={thickness}
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
        />
      </Svg>
      <View className="pointer-events-none absolute">
        {!hideCenterGlyph ? (
          <Ionicons name="hand-left-outline" size={Math.round(diameter * 0.22)} color="rgba(232,217,255,0.9)" />
        ) : null}
      </View>
    </View>
  );
}

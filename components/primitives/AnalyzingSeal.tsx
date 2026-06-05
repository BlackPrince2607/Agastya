import { Ionicons } from '@expo/vector-icons';
import { MotiView } from '@/components/moti/MotiView';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { cosmicGradients } from '@/constants/theme';

type Props = { diameter?: number; hideCenterGlyph?: boolean };

/** Circular halo + orbiting sweep while “Analyzing…” */
export function AnalyzingSeal({ diameter = 220, hideCenterGlyph }: Props) {
  const gid = `sealGlow-${diameter}`;
  const thickness = 6;
  const r = diameter / 2 - thickness / 2;
  const c = Math.PI * 2 * r;

  return (
    <View style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{ type: 'timing', duration: 12000, loop: true }}>
        <Svg width={diameter} height={diameter}>
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
            strokeDasharray={`${c * 0.62} ${c}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
          />
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={cosmicGradients.pulse[0]} />
              <Stop offset="100%" stopColor="#00CED1" />
            </LinearGradient>
          </Defs>
        </Svg>
      </MotiView>
      <View className="pointer-events-none absolute">
        {!hideCenterGlyph ? (
          <Ionicons name="hand-left-outline" size={Math.round(diameter * 0.22)} color="rgba(232,217,255,0.9)" />
        ) : null}
      </View>
    </View>
  );
}

import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

type LineKind = 'life' | 'heart' | 'head';

const LINE_COLORS: Record<LineKind, string> = {
  life: '#a855f7',
  heart: '#f472b6',
  head: '#22d3ee',
};

const LINE_PATHS: Record<LineKind, string> = {
  life: 'M 52 28 C 48 50, 44 72, 46 96',
  heart: 'M 28 52 C 38 46, 52 44, 68 48 C 78 50, 82 56, 80 62',
  head: 'M 30 38 C 48 34, 62 36, 76 42',
};

type PalmLineVisualProps = {
  line: LineKind;
  size?: number;
};

/** Stylized palm silhouette with one glowing line highlighted. */
export function PalmLineVisual({ line, size = 88 }: PalmLineVisualProps) {
  const color = LINE_COLORS[line];
  const highlight = LINE_PATHS[line];

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30"
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Palm silhouette */}
        <Path
          d="M 50 18 C 38 18, 28 28, 26 42 C 24 56, 28 68, 32 78 C 36 88, 42 94, 50 96 C 58 94, 64 88, 68 78 C 72 68, 76 56, 74 42 C 72 28, 62 18, 50 18 Z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1.2}
        />
        {/* Fingers */}
        <Path d="M 32 28 C 30 14, 34 8, 38 10 C 42 12, 40 24, 36 32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Path d="M 44 22 C 42 8, 46 4, 50 6 C 54 8, 52 18, 48 26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Path d="M 56 22 C 54 8, 58 4, 62 6 C 66 8, 64 18, 60 26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Path d="M 68 28 C 66 14, 70 8, 74 10 C 78 12, 76 24, 72 32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* Dim other lines */}
        {line !== 'life' ? (
          <Path d={LINE_PATHS.life} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ) : null}
        {line !== 'heart' ? (
          <Path d={LINE_PATHS.heart} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ) : null}
        {line !== 'head' ? (
          <Path d={LINE_PATHS.head} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ) : null}
        {/* Highlighted line with glow */}
        <Path d={highlight} fill="none" stroke={color} strokeWidth={3} strokeOpacity={0.35} />
        <Path d={highlight} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function lineKindFromName(lineName: string): LineKind {
  const lower = lineName.toLowerCase();
  if (lower.includes('heart')) return 'heart';
  if (lower.includes('head')) return 'head';
  return 'life';
}

import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { View } from 'react-native';

import type { PalmLineGeometry } from '@/types/palmAnalysis';

type Props = {
  geometry: PalmLineGeometry[];
  width: number;
  height: number;
};

const LINE_COLORS: Record<string, string> = {
  life_line: '#a855f7',
  heart_line: '#f472b6',
  head_line: '#22d3ee',
};

export function PalmLineOverlay({ geometry, width, height }: Props) {
  if (!geometry.length || width <= 0 || height <= 0) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height}>
        {geometry.map((line) => {
          const color = LINE_COLORS[line.name] ?? '#e8e4ff';
          const points = line.points
            .map((p) => `${p.x * width},${p.y * height}`)
            .join(' ');
          if (points.split(',').length < 4) return null;
          return (
            <Polyline
              key={line.name}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.85}
            />
          );
        })}
        {geometry.flatMap((line, li) =>
          line.points.map((p, pi) => (
            <Circle
              key={`${li}-${pi}`}
              cx={p.x * width}
              cy={p.y * height}
              r={3}
              fill={LINE_COLORS[line.name] ?? '#e8e4ff'}
            />
          )),
        )}
      </Svg>
    </View>
  );
}

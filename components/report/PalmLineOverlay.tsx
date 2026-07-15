import Svg, { Circle, Polyline } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/constants/theme';

import type { PalmLineGeometry } from '@/types/palmAnalysis';
import { computeImageLayout, normalizedToScreen } from '@/utils/imageLayout';

type Props = {
  geometry: PalmLineGeometry[];
  width: number;
  height: number;
  /** Natural image width — required when overlay sits on a cropped/scaled photo. */
  imageWidth?: number;
  /** Natural image height — required when overlay sits on a cropped/scaled photo. */
  imageHeight?: number;
  resizeMode?: 'cover' | 'contain';
  showVertices?: boolean;
};

const LINE_COLORS: Record<string, string> = {
  life_line: colors.purple,
  heart_line: colors.love,
  head_line: colors.cyan,
};

const LINE_LABELS: Record<string, string> = {
  life_line: 'Life',
  heart_line: 'Heart',
  head_line: 'Head',
};

export function PalmLineOverlay({
  geometry,
  width,
  height,
  imageWidth,
  imageHeight,
  resizeMode = 'cover',
  showVertices = false,
}: Props) {
  if (!geometry.length || width <= 0 || height <= 0) return null;

  const layout =
    imageWidth && imageHeight
      ? computeImageLayout(width, height, imageWidth, imageHeight, resizeMode)
      : null;

  const mapPoint = (nx: number, ny: number) => {
    if (layout) {
      const p = normalizedToScreen(nx, ny, layout);
      return `${p.x},${p.y}`;
    }
    return `${nx * width},${ny * height}`;
  };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height}>
        {geometry.map((line) => {
          const color = LINE_COLORS[line.name] ?? '#e8e4ff';
          const points = line.points.map((p) => mapPoint(p.x, p.y)).join(' ');
          if (points.split(',').length < 4) return null;
          return (
            <Polyline
              key={line.name}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeOpacity={0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {showVertices
          ? geometry.flatMap((line, li) =>
              line.points.map((p, pi) => {
                const screen = layout
                  ? normalizedToScreen(p.x, p.y, layout)
                  : { x: p.x * width, y: p.y * height };
                return (
                  <Circle
                    key={`${li}-${pi}`}
                    cx={screen.x}
                    cy={screen.y}
                    r={3}
                    fill={LINE_COLORS[line.name] ?? '#e8e4ff'}
                  />
                );
              }),
            )
          : null}
      </Svg>
    </View>
  );
}

export function palmLineLegend(): Array<{ key: string; label: string; color: string }> {
  return Object.keys(LINE_COLORS).map((key) => ({
    key,
    label: LINE_LABELS[key] ?? key,
    color: LINE_COLORS[key]!,
  }));
}

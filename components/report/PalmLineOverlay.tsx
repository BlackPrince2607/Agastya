import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';

import type { PalmLineGeometry } from '@/types/palmAnalysis';
import { computeImageLayout, nearestLineAtScreen, normalizedToScreen } from '@/utils/imageLayout';
import { palmLineBilingualName } from '@/utils/palmInsights';

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
  selectedName?: string | null;
  selectedMotif?: string | null;
  onSelectLine?: (name: string) => void;
};

const LINE_COLORS: Record<string, string> = {
  life_line: colors.purple,
  heart_line: colors.love,
  head_line: colors.cyan,
  fate_line: colors.primary,
  sun_line: '#e8b84a',
  marriage_line: '#f472b6',
};

const LINE_LABELS: Record<string, string> = {
  life_line: 'Life Line · Jeevan Rekha',
  heart_line: 'Heart Line · Hridaya Rekha',
  head_line: 'Head Line · Mastishka Rekha',
  fate_line: 'Fate Line · Bhagya Rekha',
  sun_line: 'Sun Line · Surya Rekha',
  marriage_line: 'Marriage Line · Vivah Rekha',
};

export function PalmLineOverlay({
  geometry,
  width,
  height,
  imageWidth,
  imageHeight,
  resizeMode = 'contain',
  showVertices = false,
  selectedName = null,
  selectedMotif = null,
  onSelectLine,
}: Props) {
  if (!geometry.length || width <= 0 || height <= 0) return null;

  const layout =
    imageWidth && imageHeight
      ? computeImageLayout(width, height, imageWidth, imageHeight, resizeMode)
      : {
          offsetX: 0,
          offsetY: 0,
          displayWidth: width,
          displayHeight: height,
        };

  const mapPoint = (nx: number, ny: number) => {
    const p = normalizedToScreen(nx, ny, layout);
    return `${p.x},${p.y}`;
  };

  const selected = geometry.find((g) => g.name === selectedName);
  const labelAt = selected?.points?.[Math.floor((selected.points.length - 1) / 2)];
  const labelScreen = labelAt ? normalizedToScreen(labelAt.x, labelAt.y, layout) : null;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height} pointerEvents="none">
        {geometry.map((line) => {
          const color = LINE_COLORS[line.name] ?? '#e8e4ff';
          const points = line.points.map((p) => mapPoint(p.x, p.y)).join(' ');
          if (points.split(',').length < 4) return null;
          const active = !selectedName || selectedName === line.name;
          return (
            <Polyline
              key={line.name}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={active && selectedName === line.name ? 4.2 : 3.1}
              strokeOpacity={active ? 0.95 : 0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {showVertices
          ? geometry.flatMap((line, li) =>
              line.points.map((p, pi) => {
                const screen = normalizedToScreen(p.x, p.y, layout);
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
        {labelScreen && selectedName ? (
          <>
            <SvgText
              x={Math.min(width - 8, Math.max(8, labelScreen.x + 8))}
              y={Math.max(16, labelScreen.y - 10)}
              fill={LINE_COLORS[selectedName] ?? '#e8e4ff'}
              fontSize={12}
              fontWeight="700">
              {LINE_LABELS[selectedName] ?? palmLineBilingualName(selectedName)}
            </SvgText>
            {selectedMotif ? (
              <SvgText
                x={Math.min(width - 8, Math.max(8, labelScreen.x + 8))}
                y={Math.max(30, labelScreen.y + 6)}
                fill={LINE_COLORS[selectedName] ?? '#e8e4ff'}
                fontSize={10}
                fontWeight="500">
                {selectedMotif}
              </SvgText>
            ) : null}
          </>
        ) : null}
      </Svg>
      {onSelectLine ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Palm lines. Tap a crease to see its name."
          onPress={(event) => {
            const { locationX, locationY } = event.nativeEvent;
            const hit = nearestLineAtScreen(geometry, locationX, locationY, layout);
            if (hit) onSelectLine(hit);
          }}
          style={{ position: 'absolute', left: 0, top: 0, width, height }}
        />
      ) : null}
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

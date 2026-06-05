import { useWindowDimensions, View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

/** Subtle stitch-style starfield dot grid over the void gradient */
export function CosmicDotGrid() {
  const { width, height } = useWindowDimensions();
  const w = Math.ceil(width);
  const h = Math.ceil(height);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={w} height={h}>
        <Defs>
          <Pattern id="agastya-dot-grid" width={16} height={16} patternUnits="userSpaceOnUse">
            <Circle cx={2} cy={2} r={1} fill="rgba(255,255,255,0.045)" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#agastya-dot-grid)" />
      </Svg>
    </View>
  );
}

import { useWindowDimensions } from 'react-native';

const MAX_CONTENT = 520;

/** Responsive padding and width for phone / tablet / web. */
export function useLayoutMetrics() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const contentWidth = isWide ? MAX_CONTENT : width;
  const horizontalPad = isWide ? Math.max(20, (width - MAX_CONTENT) / 2) : Math.max(16, Math.round(width * 0.05));
  const gridGap = width < 360 ? 10 : 12;
  const tileMinHeight = width < 360 ? 96 : 108;

  return {
    width,
    isWide,
    contentWidth,
    horizontalPad,
    gridGap,
    tileMinHeight,
  };
}

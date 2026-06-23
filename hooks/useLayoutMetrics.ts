import { useWindowDimensions } from 'react-native';

import { MAX_CONTENT_WIDTH, PAGE_PADDING, spacing } from '@/constants/layout';

/** Responsive padding and width for phone / tablet / web. */
export function useLayoutMetrics() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const contentWidth = isWide ? MAX_CONTENT_WIDTH : width;
  const horizontalPad = isWide ? Math.max(PAGE_PADDING, (width - MAX_CONTENT_WIDTH) / 2) : Math.max(spacing.lg, Math.round(width * 0.05));
  const gridGap = width < 360 ? spacing.sm + 2 : spacing.md;
  const tileMinHeight = width < 360 ? 96 : 108;

  return {
    width,
    isWide,
    contentWidth,
    horizontalPad,
    gridGap,
    tileMinHeight,
    pagePadding: PAGE_PADDING,
    sectionGap: spacing.lg,
    stackGap: spacing.md,
  };
}

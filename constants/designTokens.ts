/** Product design tokens — typography, spacing, and palette bridges. */
import { stitchMd3 } from '@/constants/stitchWelcome';
import { cosmicGradients, rimLight, stitchMagenta, stitchSignal, stitchViolet } from '@/constants/theme';

/** Type scale (font sizes in px) */
export const typography = {
  display: 26,
  title: 22,
  headline: 18,
  body: 15,
  caption: 13,
  label: 12,
} as const;

/** Spacing scale (px) */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const designTokens = {
  stitchMd3,
  cosmicGradients,
  rimLight,
  typography,
  spacing,
  accents: {
    signal: stitchSignal,
    magenta: stitchMagenta,
    violet: stitchViolet,
  },
} as const;

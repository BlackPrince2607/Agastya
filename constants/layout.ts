/**
 * Layout rhythm — 4px base grid used across screens.
 * Prefer Tailwind classes (`stack-md`, `gutter`) where possible; use these
 * constants for ScrollView `contentContainerStyle` and animated layouts.
 */
export const spacing = {
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px — default gutter */
  lg: 16,
  /** 20px */
  xl: 20,
  /** 24px — page horizontal margin */
  '2xl': 24,
  /** 32px — section separation */
  '3xl': 32,
  /** 48px — major section gap */
  '4xl': 48,
} as const;

/** Horizontal padding for scroll containers (phone). */
export const PAGE_PADDING = spacing['2xl'];

/** Vertical gap between major sections inside a scroll view. */
export const SECTION_GAP = spacing.xl;

/** Larger gap between major home/profile sections (greeting, cards, grids). */
export const MAIN_SECTION_GAP = 28;

/** Gap between stacked cards / list items. */
export const STACK_GAP = spacing.md;

/** Bottom clearance above floating tab bar. */
export const TAB_BAR_CLEARANCE = 120;

/** Max content width on tablet / web. */
export const MAX_CONTENT_WIDTH = 520;

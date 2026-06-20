/**
 * Agastya design tokens — "Cosmic Essence" (Stitch palmistry design system).
 *
 * This is the single source of truth for raw color values + LinearGradient
 * palettes used outside NativeWind (gradients, SVG strokes, animated styles).
 * Tailwind/NativeWind class tokens mirror these values in `tailwind.config.js`.
 */

/** Cosmic Essence palette (mirrors the Stitch `code.html` tailwind configs). */
export const colors = {
  // Surfaces — deep cosmic void to elevated glass
  surface: '#141315',
  background: '#141315',
  surfaceLowest: '#0f0e10',
  surfaceLow: '#1d1b1e',
  surfaceContainer: '#211f22',
  surfaceHigh: '#2b292c',
  surfaceHighest: '#363437',
  surfaceBright: '#3b383b',

  // Text
  onSurface: '#e6e1e5',
  onSurfaceVariant: '#cbc4ce',
  outline: '#958f98',
  outlineVariant: '#4a454d',

  // Accents
  primary: '#d3beeb',
  onPrimary: '#38294d',
  primaryContainer: '#1a0b2e',
  onPrimaryContainer: '#88769f',
  secondary: '#cfc1dd',
  onSecondaryContainer: '#c0b3cf',
  secondaryContainer: '#4e455c',
  tertiary: '#dbc39f',

  // Brand signal accents (purple / magenta nebula)
  cyan: '#22d3ee',
  purple: '#a855f7',
  magenta: '#e879f9',
  nebulaDeep: '#68577e',

  // Semantic category accents (prediction / report cards)
  love: '#f472b6',
  career: '#60a5fa',
  money: '#fbbf24',
  growth: '#c084fc',
  health: '#86efac',

  error: '#ffb4ab',
} as const;

/** LinearGradient palettes (arrays consumed by expo-linear-gradient). */
export const gradients = {
  /** App background — near-flat cosmic void. */
  cosmic: ['#0f0e10', '#141315', '#0f0e10'] as const,
  /** Primary nebula CTA (Stitch `.nebula-gradient`). */
  nebula: ['#d3beeb', '#68577e'] as const,
  /** Brand wordmark / hero accent — purple to magenta. */
  brand: ['#a855f7', '#e879f9'] as const,
  /** High-impact paywall CTA. */
  cta: ['#9333ea', '#e879f9'] as const,
  /** Soft aurora wash inside glass cards. */
  aurora: ['rgba(168,85,247,0.14)', 'rgba(232,121,249,0.06)', 'rgba(104,87,126,0.04)'] as const,
  /** Progress bar fill with glow. */
  progress: ['#a855f7', '#d946ef', '#e879f9'] as const,
} as const;

// ---------------------------------------------------------------------------
// Backward-compatible aliases (legacy import names still used across screens).
// Retuned to the Cosmic Essence palette.
// ---------------------------------------------------------------------------

export const stitchSignal = colors.cyan;
export const stitchMagenta = colors.love;
export const stitchViolet = colors.primary;
export const rimLight = '#e8dcff';

export const cosmicGradients = {
  /** Background gradient used by the root theme + CosmicScreen. */
  aurora: gradients.cosmic,
  /** Nebula CTA (lavender). */
  nebulaMd3: gradients.nebula,
  /** Brand cyan→purple pulse. */
  pulse: gradients.brand,
  /** Ember accent (kept for legacy callers). */
  ember: gradients.brand,
  /** Teal veil overlay. */
  tealVeil: ['rgba(34,211,238,0.30)', 'rgba(34,211,238,0.10)', 'rgba(15,14,16,0)'] as const,
  /** Dashboard card wash. */
  dashboardCard: ['#1d1b1e', '#141315', '#0f0e10'] as const,
} as const;

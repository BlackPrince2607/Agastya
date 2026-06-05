/** Palette for LinearGradient / NativeWind-independent styling */
export const stitchSignal = '#00CED1';
export const stitchMagenta = '#e879f9';
export const stitchViolet = '#8b5cf6';

export const cosmicGradients = {
  aurora: ['#090510', '#150c28', '#080612'] as const,
  /** Stitch MD3 nebula CTA — matches HTML onboarding exports */
  nebulaMd3: ['#d3beeb', '#68577e'] as const,
  pulse: ['#6366f1', stitchMagenta, '#38bdf8'] as const,
  ember: ['#a855f7', stitchMagenta, '#06b6d4'] as const,
  tealVeil: ['rgba(6,182,212,0.35)', 'rgba(0,206,209,0.15)', 'rgba(5,5,14,0)'] as const,
  dashboardCard: ['#1a0f38', '#12082a', '#0a0618'] as const,
} as const;

export const rimLight = '#e8dcff';

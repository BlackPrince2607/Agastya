/** Onboarding step numbers — keep headers aligned to these values. */
export const ONBOARDING_TOTAL_STEPS = 7;

export const ONBOARDING_STEPS = {
  trust: 1,
  profile: 2,
  goals: 3,
  palmScan: 4,
  analysis: 5,
  reportPreview: 6,
  /** Save account — final numbered step */
  account: 7,
  /** Paywall is an optional branch; not counted in progress */
  paywall: 7,
} as const;

/** Step shown in header when user is on paywall (optional upgrade) */
export const ONBOARDING_PAYWALL_DISPLAY_STEP = 7;

/** @deprecated Review step replaced pre-analysis delay; kept for legacy references. */
export const PALM_SCAN_PROCESSING_MS = 0;

/** Fixed time for the analysis loading screen progress (0 → 100%). */
export const ANALYSIS_MIN_DURATION_MS = 5500;

/** How long each analysis loading phrase stays visible. */
export const ANALYSIS_PHRASE_MS = 1600;

/** Brief pause at 100% so the bar does not cut away abruptly. */
export const ANALYSIS_SETTLE_MS = 700;

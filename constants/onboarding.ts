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

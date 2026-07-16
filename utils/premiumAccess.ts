import type { Href } from 'expo-router';

import { isEmailPremiumAllowlisted } from '@/utils/premiumAllowlist';
import { useSessionStore } from '@/store/sessionStore';

export function hasPremiumAccess(): boolean {
  if (useSessionStore.getState().hasUnlockedPremium) return true;
  return isEmailPremiumAllowlisted();
}

/** Onboarding preview report — free tier landing after sign-in. */
export function previewReportHref(): Href {
  const seed = useSessionStore.getState().readingSeed;
  if (seed) {
    return { pathname: '/onboarding/report-preview', params: { seed } };
  }
  return '/onboarding/report-preview';
}

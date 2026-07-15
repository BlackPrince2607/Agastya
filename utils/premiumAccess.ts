import type { Href } from 'expo-router';

import { useSessionStore } from '@/store/sessionStore';

export function hasPremiumAccess(): boolean {
  return useSessionStore.getState().hasUnlockedPremium;
}

/** Onboarding preview report — free tier landing after sign-in. */
export function previewReportHref(): Href {
  const seed = useSessionStore.getState().readingSeed;
  if (seed) {
    return { pathname: '/onboarding/report-preview', params: { seed } };
  }
  return '/onboarding/report-preview';
}

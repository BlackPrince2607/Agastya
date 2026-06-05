import type { Href } from 'expo-router';

import { leaveMainAppForOnboarding } from '@/services/authSession';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { bootstrapIdentity } from '@/services/identity';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterReplace } from '@/utils/routerDefer';

export function hasRitualReading(): boolean {
  const s = useSessionStore.getState();
  return Boolean(s.previewReading || s.fullReading || s.palmAnalysis);
}

/** Where an interrupted or returning user should resume (before main). */
export function resolveResumeHref(): Href {
  const s = useSessionStore.getState();

  if (s.hasEnteredMain) {
    return '/home';
  }

  if (s.previewReading || s.palmAnalysis) {
    return '/onboarding/report-preview';
  }

  if (s.userDisplayName && s.userGender && s.focusTopics.length > 0) {
    return '/onboarding/palm-scan';
  }

  if (s.userDisplayName && s.userGender) {
    return '/onboarding/goals';
  }

  if (s.userDisplayName) {
    return '/onboarding/profile';
  }

  return '/onboarding';
}

export function enterMainApp() {
  useSessionStore.getState().setEnteredMain(true);
  deferRouterReplace('/home');
}

/** Return to ritual from main (keeps reading data). */
export function replayOnboarding() {
  leaveMainAppForOnboarding();
  deferRouterReplace('/onboarding');
}

/** Bootstrap + cloud restore, then route sign-in / returning users. */
export async function prepareReturningUser(): Promise<Href> {
  await bootstrapIdentity();
  await restoreSessionFromServer({ force: true });

  const s = useSessionStore.getState();

  if (s.hasEnteredMain) {
    return '/home';
  }

  return resolveResumeHref();
}

export async function routeAfterSignInIntent(): Promise<void> {
  const href = await prepareReturningUser();
  if (href === '/home') {
    enterMainApp();
    return;
  }
  if (href === '/onboarding') {
    deferRouterReplace('/onboarding/account');
    return;
  }
  deferRouterReplace(href);
}

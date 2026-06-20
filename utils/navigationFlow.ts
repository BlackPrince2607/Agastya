import type { Href } from 'expo-router';

import { readAuthSession, leaveMainAppForOnboarding } from '@/services/authSession';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { bootstrapIdentity } from '@/services/identity';
import { requestNotificationPermission } from '@/services/notifications';
import { requiresSupabaseSignIn } from '@/services/authConfig';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterReplace } from '@/utils/routerDefer';

export function hasRitualReading(): boolean {
  const s = useSessionStore.getState();
  return Boolean(s.previewReading || s.fullReading || s.palmAnalysis);
}

export type EnterMainResult = 'ok' | 'need_sign_in' | 'need_ritual';

/** Whether the user has met requirements to access the main app. */
export async function canEnterMainApp(): Promise<EnterMainResult> {
  if (!hasRitualReading()) {
    return 'need_ritual';
  }
  if (requiresSupabaseSignIn()) {
    const auth = await readAuthSession();
    if (!auth.isSignedIn) {
      return 'need_sign_in';
    }
  }
  return 'ok';
}

/** Where an interrupted or returning user should resume (before main). */
export function resolveResumeHref(): Href {
  const s = useSessionStore.getState();

  if (s.hasEnteredMain) {
    return '/(main)/home';
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

export async function tryEnterMainApp(): Promise<EnterMainResult> {
  const gate = await canEnterMainApp();
  if (gate !== 'ok') {
    return gate;
  }
  useSessionStore.getState().setEnteredMain(true);
  void requestNotificationPermission();
  deferRouterReplace('/(main)/home');
  return 'ok';
}

export function enterMainApp() {
  void tryEnterMainApp().then((result) => {
    if (result === 'need_sign_in') {
      deferRouterReplace('/onboarding/account');
    } else if (result === 'need_ritual') {
      deferRouterReplace(resolveResumeHref());
    }
  });
}

/** Return to ritual from main (keeps reading data). */
export function replayOnboarding() {
  leaveMainAppForOnboarding();
  deferRouterReplace(resolveResumeHref());
}

/** Bootstrap + cloud restore, then route sign-in / returning users. */
export async function prepareReturningUser(forceRestore = false): Promise<Href> {
  await bootstrapIdentity();
  if (forceRestore) {
    await restoreSessionFromServer({ force: true });
  } else {
    // Route from local state immediately; cloud restore fills in gaps in the background.
    void restoreSessionFromServer();
  }

  const s = useSessionStore.getState();

  if (s.hasEnteredMain) {
    const gate = await canEnterMainApp();
    if (gate === 'need_sign_in') {
      return '/onboarding/account';
    }
    if (gate === 'need_ritual') {
      s.setEnteredMain(false);
      return resolveResumeHref();
    }
    return '/(main)/home';
  }

  return resolveResumeHref();
}

export async function routeAfterSignInIntent(): Promise<void> {
  const href = await prepareReturningUser(true);
  if (href === '/(main)/home') {
    const result = await tryEnterMainApp();
    if (result === 'need_ritual') {
      deferRouterReplace(resolveResumeHref());
    }
    return;
  }
  if (href === '/onboarding') {
    deferRouterReplace('/onboarding/account');
    return;
  }
  deferRouterReplace(href);
}

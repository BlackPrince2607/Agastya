import type { Href } from 'expo-router';

import {
  consumePostSignInReturn,
  leaveMainAppForOnboarding,
  readAuthSession,
  syncAuthUserToStore,
} from '@/services/authSession';
import { requiresSupabaseSignIn } from '@/services/authConfig';
import { ensureSessionMerged } from '@/services/authMerge';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { bootstrapIdentity } from '@/services/identity';
import { requestNotificationPermission } from '@/services/notifications';
import { isApiConfigured } from '@/services/env';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterReplace, resetAppNavigation } from '@/utils/routerDefer';

export function hasRitualReading(): boolean {
  const s = useSessionStore.getState();
  return Boolean(s.previewReading || s.fullReading || s.palmAnalysis);
}

export type EnterMainResult = 'ok' | 'need_sign_in' | 'need_ritual';

/** Sync gate from persisted local state — safe on cold start (no Supabase storage read). */
export function canEnterMainAppSync(): EnterMainResult {
  if (!hasRitualReading()) {
    return 'need_ritual';
  }
  if (!requiresSupabaseSignIn()) {
    return 'ok';
  }
  if (useSessionStore.getState().supabaseUserId) {
    return 'ok';
  }
  return 'need_sign_in';
}

/** Whether the user has met requirements to access the main app. */
export async function canEnterMainApp(): Promise<EnterMainResult> {
  return canEnterMainAppSync();
}

/**
 * Resume unsigned onboarding at the next incomplete step (may be palm-scan).
 * Do not use after sign-in — use `resolveSignedInHrefSync` instead.
 */
export function resolveOnboardingHref(): Href {
  const s = useSessionStore.getState();

  if (s.previewReading || s.palmAnalysis) {
    return '/onboarding/report-preview';
  }

  if (!s.userDisplayName) {
    return '/onboarding';
  }

  if (!s.userGender) {
    return '/onboarding/profile';
  }

  if (s.focusTopics.length === 0) {
    return '/onboarding/goals';
  }

  return '/onboarding/palm-scan';
}

/** @deprecated Use resolveOnboardingHref — kept for call sites being migrated. */
export function resolveResumeHref(): Href {
  const s = useSessionStore.getState();
  if (s.hasEnteredMain) {
    return '/(main)/home';
  }
  return resolveOnboardingHref();
}

/**
 * Where a signed-in user should land. Never auto-redirects to palm-scan
 * (account is the hub when profile is done but reading is missing).
 */
export function resolveSignedInHrefSync(): Href {
  const gate = canEnterMainAppSync();
  if (gate === 'ok') {
    useSessionStore.getState().setEnteredMain(true);
    void requestNotificationPermission();
    return '/(main)/home';
  }

  if (hasRitualReading()) {
    return '/onboarding/report-preview';
  }

  const s = useSessionStore.getState();
  if (!s.userDisplayName) {
    return '/onboarding';
  }
  if (!s.userGender) {
    return '/onboarding/profile';
  }
  if (s.focusTopics.length === 0) {
    return '/onboarding/goals';
  }

  return '/onboarding/account';
}

/** When main/report gates block access, pick a safe onboarding target. */
export function resolveBlockedAppHref(isSignedIn: boolean): Href {
  if (isSignedIn && requiresSupabaseSignIn()) {
    return resolveSignedInHrefSync();
  }
  if (hasRitualReading()) {
    return '/onboarding/report-preview';
  }
  return resolveOnboardingHref();
}

/** Merge cloud session + restore reading before any route decision that depends on ritual state. */
export async function ensureCloudStateSynced(force = false): Promise<void> {
  if (!isApiConfigured()) return;
  if (!force && useSessionStore.getState().skipCloudRestore) return;

  await bootstrapIdentity();
  const snap = useSessionStore.getState();
  if (!snap.sessionId) return;

  try {
    if (requiresSupabaseSignIn()) {
      const auth = await readAuthSession();
      if (auth.isSignedIn && auth.userId) {
        syncAuthUserToStore(auth.userId);
      }
    }
    await ensureSessionMerged();
    await restoreSessionFromServer({ force });
  } catch {
    /* best-effort */
  }
}

/** Fire-and-forget cloud merge + restore (never blocks navigation). */
export function syncCloudSessionInBackground(): void {
  if (!isApiConfigured()) return;
  if (useSessionStore.getState().skipCloudRestore) return;
  void ensureCloudStateSynced(false);
}

/** Sync Supabase session into the store before routing decisions. */
async function syncAuthFromSupabase(): Promise<boolean> {
  if (!requiresSupabaseSignIn()) return false;
  const auth = await readAuthSession();
  if (auth.isSignedIn && auth.userId) {
    syncAuthUserToStore(auth.userId);
    return true;
  }
  syncAuthUserToStore(null);
  return false;
}

/** Sync auth + cloud, then return destination for a signed-in user. */
export async function resolveAuthenticatedHref(): Promise<Href> {
  const returnHref = consumePostSignInReturn();
  if (returnHref) {
    return returnHref;
  }

  await bootstrapIdentity();
  const auth = await readAuthSession();
  if (auth.userId) {
    syncAuthUserToStore(auth.userId);
  }

  if (auth.isSignedIn && !useSessionStore.getState().skipCloudRestore) {
    await ensureCloudStateSynced(true);
  }

  return resolveSignedInHrefSync();
}

/** Sync auth + return the correct destination after sign-in (no navigation). */
export async function resolvePostSignInHref(): Promise<Href> {
  return resolveAuthenticatedHref();
}

export async function tryEnterMainApp(): Promise<EnterMainResult> {
  const gate = canEnterMainAppSync();
  if (gate !== 'ok') {
    return gate;
  }
  useSessionStore.getState().setEnteredMain(true);
  void requestNotificationPermission();
  resetAppNavigation('/(main)/home');
  return 'ok';
}

export function enterMainApp() {
  void tryEnterMainApp().then((result) => {
    if (result === 'need_sign_in') {
      deferRouterReplace('/onboarding/account');
    } else if (result === 'need_ritual') {
      const href =
        useSessionStore.getState().supabaseUserId
          ? resolveSignedInHrefSync()
          : resolveOnboardingHref();
      deferRouterReplace(href);
    }
  });
}

/** Return to ritual from main (keeps profile; clears reading so palm scan can run again). */
export function replayOnboarding() {
  const store = useSessionStore.getState();
  leaveMainAppForOnboarding();
  store.clearRitualProgress();
  store.setSkipCloudRestore(true);

  const s = useSessionStore.getState();
  let target: Href = '/onboarding';
  if (s.userDisplayName && s.userGender && s.focusTopics.length > 0) {
    target = '/onboarding/palm-scan';
  } else if (s.userDisplayName && s.userGender) {
    target = '/onboarding/goals';
  } else if (s.userDisplayName) {
    target = '/onboarding/profile';
  }

  resetAppNavigation(target);
}

/** Bootstrap + route from local store; cloud restore awaited when it affects the gate. */
export async function prepareReturningUser(forceRestore = false): Promise<Href> {
  await bootstrapIdentity();
  const isSignedIn = await syncAuthFromSupabase();

  const snap = useSessionStore.getState();
  const shouldAwaitCloud =
    isApiConfigured() &&
    Boolean(snap.sessionId) &&
    !snap.skipCloudRestore &&
    (forceRestore || snap.hasEnteredMain || isSignedIn || !hasRitualReading());

  if (shouldAwaitCloud) {
    await ensureCloudStateSynced(forceRestore || snap.hasEnteredMain || isSignedIn);
  }

  if (isSignedIn && requiresSupabaseSignIn()) {
    return resolveSignedInHrefSync();
  }

  const s = useSessionStore.getState();

  if (s.hasEnteredMain) {
    const gate = canEnterMainAppSync();
    if (gate === 'ok') {
      return '/(main)/home';
    }
    if (gate === 'need_sign_in') {
      return '/onboarding/account';
    }
    return hasRitualReading() ? '/onboarding/report-preview' : resolveOnboardingHref();
  }

  if (hasRitualReading()) {
    const gate = canEnterMainAppSync();
    if (gate === 'ok') {
      useSessionStore.getState().setEnteredMain(true);
      void requestNotificationPermission();
      return '/(main)/home';
    }
    if (gate === 'need_sign_in') {
      return '/onboarding/account';
    }
    return '/onboarding/report-preview';
  }

  return resolveOnboardingHref();
}

/** Route after OAuth, email, or magic-link sign-in. */
export async function routeAfterSignInIntent(): Promise<void> {
  const href = await resolvePostSignInHref();
  if (__DEV__) {
    console.log('[Agastya auth] post-sign-in route →', href);
  }
  if (href === '/(main)/home') {
    resetAppNavigation(href);
    return;
  }
  deferRouterReplace(href);
}

type AccountBackParams = {
  fromPaywall?: string;
  fromProfile?: string;
  seed?: string;
};

/** Where the account screen back button should return. */
export function resolveAccountBackHref(params: AccountBackParams = {}): Href {
  if (params.fromPaywall === '1') {
    return params.seed
      ? { pathname: '/onboarding/paywall', params: { seed: params.seed } }
      : '/onboarding/paywall';
  }
  if (params.fromProfile === '1') {
    return '/(main)/profile';
  }

  const s = useSessionStore.getState();
  if (s.supabaseUserId && (s.hasEnteredMain || hasRitualReading())) {
    return s.hasEnteredMain ? '/(main)/home' : '/welcome';
  }

  if (hasRitualReading()) {
    return params.seed
      ? { pathname: '/onboarding/report-preview', params: { seed: params.seed } }
      : '/onboarding/report-preview';
  }

  return '/welcome';
}

/** Normalize deep-link / notification paths to expo-router hrefs. */
export function normalizeAppDeepLink(link: string): Href {
  const trimmed = link.trim();
  if (trimmed === '/tasks' || trimmed === '/(main)/tasks') return '/(main)/tasks';
  if (trimmed === '/chat' || trimmed === '/(main)/chat') return '/(main)/chat';
  if (trimmed === '/home' || trimmed === '/(main)/home') return '/(main)/home';
  if (trimmed === '/profile' || trimmed === '/(main)/profile') return '/(main)/profile';
  if (trimmed === '/report' || trimmed.startsWith('/report/')) return trimmed as Href;
  return trimmed as Href;
}

/** Open the screen from a tapped notification (foreground, background, or cold start). */
export async function navigateFromNotification(link: string): Promise<void> {
  const { router } = await import('expo-router');
  const target = normalizeAppDeepLink(link);

  if (!useSessionStore.getState().hasEnteredMain && hasRitualReading()) {
    const gate = await tryEnterMainApp();
    if (gate === 'need_sign_in') {
      deferRouterReplace('/onboarding/account');
      return;
    }
    if (gate === 'need_ritual') {
      deferRouterReplace(resolveBlockedAppHref(Boolean(useSessionStore.getState().supabaseUserId)));
      return;
    }
  }

  router.push(target as never);
}

/** Whether a deep link targets the main tab shell. */
export function isMainTabDeepLink(link: string): boolean {
  const normalized = normalizeAppDeepLink(link);
  return (
    normalized === '/(main)/home' ||
    normalized === '/(main)/chat' ||
    normalized === '/(main)/tasks' ||
    normalized === '/(main)/profile'
  );
}

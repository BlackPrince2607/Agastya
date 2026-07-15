import type { Href } from 'expo-router';
import { router } from 'expo-router';

import { resolveAccountBackHref, resolveOnboardingHref } from '@/utils/navigationFlow';
import { resolvePaywallBackHref } from '@/utils/paywallNavigation';
import { useSessionStore } from '@/store/sessionStore';

export type RouteParams = Record<string, string | undefined>;

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, '');
  return trimmed || '/';
}

/** Prefer pathname; fall back to segment trail when expo-router omits group prefixes. */
export function resolveNavigationPath(pathname: string, segments: string[] = []): string {
  const fromPath = normalizePathname(pathname);
  if (fromPath.startsWith('/onboarding') || fromPath.startsWith('/report') || fromPath.startsWith('/task/')) {
    return fromPath;
  }

  const trail = segments.filter((segment) => !segment.startsWith('(')).join('/');
  if (!trail) return fromPath;
  return normalizePathname(`/${trail}`);
}

export function normalizeRouteParams(
  params: Record<string, string | string[] | undefined> = {},
): RouteParams {
  const out: RouteParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}

function resolvedSeed(params: RouteParams): string | undefined {
  return params.seed ?? useSessionStore.getState().readingSeed ?? undefined;
}

function accountEmailBack(params: RouteParams): Href {
  const seed = resolvedSeed(params);
  return {
    pathname: '/onboarding/account',
    params: {
      ...(seed ? { seed } : {}),
      ...(params.fromPaywall ? { fromPaywall: params.fromPaywall } : {}),
      ...(params.fromProfile ? { fromProfile: params.fromProfile } : {}),
    },
  };
}

/** Deterministic back target when the stack has no history to pop. */
export function resolveBackHref(pathname: string, params: RouteParams = {}): Href | undefined {
  const path = normalizePathname(pathname);
  const entered = useSessionStore.getState().hasEnteredMain;

  switch (path) {
    case '/onboarding':
      return '/welcome';
    case '/onboarding/profile':
      return '/onboarding';
    case '/onboarding/goals':
      return '/onboarding/profile';
    case '/onboarding/palm-scan':
      return '/onboarding/goals';
    case '/onboarding/analysis':
      return '/onboarding/palm-scan';
    case '/onboarding/report-preview':
      return '/onboarding/palm-scan';
    case '/onboarding/account':
    case '/onboarding/account-email':
      return resolveAccountBackHref({
        fromPaywall: params.fromPaywall,
        fromProfile: params.fromProfile,
        seed: resolvedSeed(params),
      });
    case '/onboarding/paywall':
      return resolvePaywallBackHref(params.returnTo, resolvedSeed(params));
    case '/report':
    case '/report/compatibility':
      return entered ? '/(main)/home' : '/onboarding/report-preview';
    case '/report/partner-palm-scan':
    case '/report/partner-palm-analysis':
      return '/report/compatibility';
    case '/edit-profile':
      return '/(main)/profile';
    case '/auth/reset-password':
      return '/onboarding/account';
    default:
      if (path.startsWith('/task/')) {
        return '/(main)/tasks';
      }
      return undefined;
  }
}

type GoBackOptions = {
  pathname?: string;
  segments?: string[];
  params?: RouteParams;
  fallback?: Href;
  onCustomBack?: () => void;
};

/**
 * Back navigation — pop the stack when possible; only replace when history is empty.
 */
export function goBack({
  pathname = '',
  segments = [],
  params = {},
  fallback,
  onCustomBack,
}: GoBackOptions = {}) {
  if (onCustomBack) {
    onCustomBack();
    return;
  }

  if (router.canGoBack()) {
    router.back();
    return;
  }

  const path = resolveNavigationPath(pathname, segments);
  const mapped = fallback ?? (path ? resolveBackHref(path, params) : undefined);

  if (mapped) {
    router.replace(mapped);
    return;
  }

  router.replace(
    useSessionStore.getState().hasEnteredMain ? '/(main)/home' : resolveOnboardingHref(),
  );
}

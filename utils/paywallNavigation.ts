import type { Href } from 'expo-router';

export type PaywallReturnTarget =
  | '/(main)/home'
  | '/(main)/chat'
  | '/(main)/profile'
  | '/(main)/tasks'
  | '/report'
  | '/onboarding/report-preview';

const RETURN_ALIASES: Record<string, PaywallReturnTarget> = {
  '/(main)/home': '/(main)/home',
  '/home': '/(main)/home',
  '/(main)/chat': '/(main)/chat',
  '/chat': '/(main)/chat',
  '/(main)/profile': '/(main)/profile',
  '/profile': '/(main)/profile',
  '/(main)/tasks': '/(main)/tasks',
  '/tasks': '/(main)/tasks',
  '/report': '/report',
  '/onboarding/report-preview': '/onboarding/report-preview',
};

/** Normalize paywall return target from route params. */
export function normalizePaywallReturn(returnTo?: string): PaywallReturnTarget {
  if (!returnTo) return '/onboarding/report-preview';
  return RETURN_ALIASES[returnTo] ?? '/onboarding/report-preview';
}

/** Where paywall secondary back should route. */
export function resolvePaywallBackHref(returnTo?: string, seed?: string): Href {
  const target = normalizePaywallReturn(returnTo);
  if (target === '/onboarding/report-preview' && seed) {
    return { pathname: '/onboarding/report-preview', params: { seed } };
  }
  return target;
}

export function paywallRouteParams(returnTo: PaywallReturnTarget, seed?: string) {
  return {
    pathname: '/onboarding/paywall' as const,
    params: { returnTo, ...(seed ? { seed } : {}) },
  };
}

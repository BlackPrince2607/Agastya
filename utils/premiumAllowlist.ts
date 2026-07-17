/**
 * Comma-separated emails in EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST get free premium
 * (founder / tester accounts) without RevenueCat or Stripe.
 */

import { useSessionStore } from '@/store/sessionStore';

let cachedAuthEmail: string | null = null;

/** Always-on founder accounts (also set EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST in .env). */
const BUILTIN_ALLOWLIST = new Set(['sohambhalotia@gmail.com']);

function parseAllowlist(): Set<string> {
  const raw = process.env.EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST ?? '';
  const fromEnv = raw
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...BUILTIN_ALLOWLIST, ...fromEnv]);
}

/** Keep the signed-in email so sync `hasPremiumAccess()` checks work. */
export function setPremiumAllowlistEmail(email: string | null | undefined): void {
  const next = email?.trim().toLowerCase() || null;
  cachedAuthEmail = next;
  if (next && parseAllowlist().has(next) && !useSessionStore.getState().hasUnlockedPremium) {
    useSessionStore.getState().setPremium(true);
  }
}

export function getPremiumAllowlistEmail(): string | null {
  return cachedAuthEmail;
}

export function isEmailPremiumAllowlisted(email?: string | null): boolean {
  const candidate = (email ?? cachedAuthEmail)?.trim().toLowerCase();
  if (!candidate) return false;
  return parseAllowlist().has(candidate);
}

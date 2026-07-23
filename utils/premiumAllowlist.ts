/**
 * Comma-separated emails in EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST get free premium
 * (founder accounts) only while signed in with that email — never while signed out.
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
  const prev = cachedAuthEmail;
  const next = email?.trim().toLowerCase() || null;
  cachedAuthEmail = next;
  const list = parseAllowlist();

  if (next && list.has(next)) {
    // Free premium only after this allowlisted account is signed in.
    useSessionStore.getState().setPremium(true);
    return;
  }

  // Signed out or switched to a non-allowlisted account — revoke allowlist unlock.
  // Paid entitlement is restored by server bootstrap when applicable.
  if (prev && list.has(prev)) {
    useSessionStore.getState().setPremium(false);
  }
}

export function getPremiumAllowlistEmail(): string | null {
  return cachedAuthEmail;
}

/** True only when a signed-in email is on the allowlist (cached from auth). */
export function isEmailPremiumAllowlisted(email?: string | null): boolean {
  const candidate = (email ?? cachedAuthEmail)?.trim().toLowerCase();
  if (!candidate) return false;
  return parseAllowlist().has(candidate);
}

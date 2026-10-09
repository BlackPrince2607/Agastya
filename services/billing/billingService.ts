import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  cancelRazorpaySubscription,
  createRazorpayPaymentLink,
  confirmRazorpayPayment,
  fetchBillingConfig,
  verifyGooglePlayPurchase,
} from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { persistentStorage } from '@/services/persistentStorage';
import type { BillingPeriod } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

export type BillingPlanInfo = {
  amount: number;
  currency: string;
  interval?: 'week' | 'month' | 'year' | null;
  autoRenew?: boolean;
};

export type BillingConfig = {
  country: string | null;
  currency: string;
  plans: Record<string, BillingPlanInfo>;
};

export type CheckoutResult =
  | { ok: true; redirecting: true }
  | {
      ok: false;
      reason: 'cancelled' | 'unavailable' | 'failed' | 'need_sign_in' | 'already_premium';
    };

const CHECKOUT_PENDING_KEY = 'agastya.billing.checkoutPending';
/** A browser checkout older than this is abandoned; stop auto-confirming it. */
const CHECKOUT_PENDING_TTL_MS = 60 * 60 * 1000;

let cachedConfig: { at: number; config: BillingConfig | null } | null = null;

/** Last checkout intent created on this device — used when deep-link params are missing. */
let lastCheckoutIntentId: string | null = null;

/** Browser checkout was opened; app should confirm on resume even if deep link never arrives. */
let checkoutReturnPending = false;

export function getLastCheckoutIntentId(): string | null {
  return lastCheckoutIntentId;
}

export function clearLastCheckoutIntentId(): void {
  lastCheckoutIntentId = null;
  checkoutReturnPending = false;
  void persistentStorage.removeItem(CHECKOUT_PENDING_KEY);
}

async function markCheckoutOpened(intentId: string | null): Promise<void> {
  lastCheckoutIntentId = intentId;
  checkoutReturnPending = true;
  try {
    await persistentStorage.setItem(
      CHECKOUT_PENDING_KEY,
      JSON.stringify({ id: intentId, at: Date.now() }),
    );
  } catch {
    /* ignore storage failures */
  }
}

async function hydrateCheckoutPending(): Promise<void> {
  if (checkoutReturnPending || lastCheckoutIntentId) return;
  try {
    const stored = await persistentStorage.getItem(CHECKOUT_PENDING_KEY);
    if (!stored) return;
    let parsed: { id?: string | null; at?: number } | null = null;
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = null;
    }
    // Legacy plain-string entries carry no timestamp — treat them as abandoned.
    if (!parsed || typeof parsed.at !== 'number' || Date.now() - parsed.at > CHECKOUT_PENDING_TTL_MS) {
      await persistentStorage.removeItem(CHECKOUT_PENDING_KEY);
      return;
    }
    checkoutReturnPending = true;
    lastCheckoutIntentId = parsed.id || null;
  } catch {
    /* ignore */
  }
}

/** Whether a Razorpay browser checkout is waiting for confirm (deep link may never arrive). */
export async function isCheckoutReturnPending(): Promise<boolean> {
  await hydrateCheckoutPending();
  return checkoutReturnPending || Boolean(lastCheckoutIntentId);
}

/** Sync peek — true only after hydrate or markCheckoutOpened in this JS runtime. */
export function isCheckoutReturnPendingSync(): boolean {
  return checkoutReturnPending || Boolean(lastCheckoutIntentId);
}

export async function getBillingConfig(force = false): Promise<BillingConfig | null> {
  if (!isApiConfigured()) return null;
  const ttl = Number(process.env.EXPO_PUBLIC_BILLING_CONFIG_CACHE_MS ?? 60_000);
  if (!force && cachedConfig && Date.now() - cachedConfig.at < ttl) {
    return cachedConfig.config;
  }
  try {
    const config = await fetchBillingConfig('android');
    cachedConfig = { at: Date.now(), config };
    return config;
  } catch {
    return cachedConfig?.config ?? null;
  }
}

function checkoutReturnUrls(): { successUrl: string; cancelUrl: string } {
  const base = Linking.createURL('/onboarding/paywall');
  return {
    successUrl: `${base}?checkout=success&provider=razorpay`,
    cancelUrl: `${base}?checkout=cancelled&provider=razorpay`,
  };
}

/** Create Razorpay Payment Link and open hosted checkout. */
export async function startRazorpayCheckout(options: {
  period: BillingPeriod;
  externalTransactionToken?: string | null;
  administrativeArea?: string | null;
}): Promise<CheckoutResult> {
  if (!isApiConfigured()) {
    return { ok: false, reason: 'unavailable' };
  }

  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) {
    return { ok: false, reason: 'unavailable' };
  }
  if (!snap.supabaseUserId) {
    return { ok: false, reason: 'need_sign_in' };
  }

  const { successUrl, cancelUrl } = checkoutReturnUrls();

  let checkoutUrl: string;
  let checkoutIntentId: string;
  try {
    ({ checkoutUrl, checkoutIntentId } = await createRazorpayPaymentLink({
      sessionId: snap.sessionId,
      deviceInstallId: snap.deviceInstallId,
      billingPeriod: options.period,
      successUrl,
      cancelUrl,
      externalTransactionToken: options.externalTransactionToken ?? undefined,
      administrativeArea: options.administrativeArea ?? undefined,
      platform: 'android',
    }));
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (status === 409) return { ok: false, reason: 'already_premium' };
    if (status === 401) return { ok: false, reason: 'need_sign_in' };
    return { ok: false, reason: 'failed' };
  }

  await markCheckoutOpened(checkoutIntentId || null);
  try {
    await Linking.openURL(checkoutUrl);
  } catch {
    // Browser never opened — do not leave the paywall waiting for a return that cannot happen.
    clearLastCheckoutIntentId();
    return { ok: false, reason: 'failed' };
  }
  return { ok: true, redirecting: true };
}

export type ConfirmRazorpayOptions = {
  checkoutIntentId?: string | null;
  paymentLinkId?: string | null;
  paymentId?: string | null;
  paymentLinkReferenceId?: string | null;
  paymentLinkStatus?: string | null;
  razorpaySignature?: string | null;
};

/** Ask backend to verify Payment Link with Razorpay API and grant premium. */
export async function confirmRazorpayCheckout(
  options: ConfirmRazorpayOptions = {},
): Promise<{ ok: true } | { ok: false; status?: string }> {
  if (!isApiConfigured()) {
    return { ok: false };
  }
  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) {
    return { ok: false };
  }

  try {
    const result = await confirmRazorpayPayment({
      sessionId: snap.sessionId,
      deviceInstallId: snap.deviceInstallId,
      checkoutIntentId: options.checkoutIntentId || lastCheckoutIntentId || undefined,
      paymentLinkId: options.paymentLinkId || undefined,
      paymentId: options.paymentId || undefined,
      paymentLinkReferenceId: options.paymentLinkReferenceId || undefined,
      paymentLinkStatus: options.paymentLinkStatus || undefined,
      razorpaySignature: options.razorpaySignature || undefined,
    });
    if (result.isPremium) {
      clearLastCheckoutIntentId();
      return { ok: true };
    }
    return { ok: false, status: result.status };
  } catch (err) {
    if ((err as { status?: number } | null)?.status === 404) {
      // Server has no checkout for this session — stop waiting so the user can pay again.
      clearLastCheckoutIntentId();
      return { ok: false, status: 'not_found' };
    }
    return { ok: false };
  }
}

export type CancelSubscriptionResult =
  | { ok: true; accessUntil: string | null }
  | { ok: false; reason: 'not_found' | 'unavailable' | 'failed' };

/** Stop Razorpay auto-renewal; Premium stays active until the paid period ends. */
export async function cancelRazorpaySubscriptionForSession(): Promise<CancelSubscriptionResult> {
  if (!isApiConfigured()) {
    return { ok: false, reason: 'unavailable' };
  }
  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const result = await cancelRazorpaySubscription({
      sessionId: snap.sessionId,
      deviceInstallId: snap.deviceInstallId,
    });
    return { ok: true, accessUntil: result.accessUntil ?? null };
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (status === 404) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'failed' };
  }
}

/** Verify Google Play purchase token with backend (Play User Choice path). */
export async function verifyPlayPurchase(options: {
  purchaseToken: string;
  productId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'unavailable' | 'failed' }> {
  if (!isApiConfigured()) {
    return { ok: false, reason: 'unavailable' };
  }

  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    await verifyGooglePlayPurchase({
      sessionId: snap.sessionId,
      deviceInstallId: snap.deviceInstallId,
      purchaseToken: options.purchaseToken,
      productId: options.productId,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export function isAndroidBillingAvailable(): boolean {
  return Platform.OS === 'android' && isApiConfigured();
}

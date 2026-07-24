import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  createRazorpayPaymentLink,
  confirmRazorpayPayment,
  fetchBillingConfig,
  verifyGooglePlayPurchase,
} from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import type { BillingPeriod } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

export type BillingPlanInfo = {
  amount: number;
  currency: string;
};

export type BillingConfig = {
  country: string | null;
  currency: string;
  plans: Record<string, BillingPlanInfo>;
};

export type CheckoutResult =
  | { ok: true; redirecting: true }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'failed' | 'need_sign_in' };

let cachedConfig: { at: number; config: BillingConfig | null } | null = null;

/** Last checkout intent created on this device — used when deep-link params are missing. */
let lastCheckoutIntentId: string | null = null;

export function getLastCheckoutIntentId(): string | null {
  return lastCheckoutIntentId;
}

export function clearLastCheckoutIntentId(): void {
  lastCheckoutIntentId = null;
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

  try {
    const { checkoutUrl, checkoutIntentId } = await createRazorpayPaymentLink({
      sessionId: snap.sessionId,
      deviceInstallId: snap.deviceInstallId,
      billingPeriod: options.period,
      successUrl,
      cancelUrl,
      externalTransactionToken: options.externalTransactionToken ?? undefined,
      administrativeArea: options.administrativeArea ?? undefined,
      platform: 'android',
    });

    if (checkoutIntentId) {
      lastCheckoutIntentId = checkoutIntentId;
    }

    await Linking.openURL(checkoutUrl);
    return { ok: true, redirecting: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
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
  } catch {
    return { ok: false };
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

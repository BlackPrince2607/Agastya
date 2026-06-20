import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { createStripeCheckoutSession } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { isStripeCheckoutEnabled } from '@/services/revenuecat';
import { useSessionStore } from '@/store/sessionStore';

export type StripeCheckoutResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

function checkoutReturnUrls(): { successUrl: string; cancelUrl: string } {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin;
    return {
      successUrl: `${origin}/onboarding/paywall?checkout=success`,
      cancelUrl: `${origin}/onboarding/paywall?checkout=cancelled`,
    };
  }
  const base = Linking.createURL('/onboarding/paywall');
  return {
    successUrl: `${base}?checkout=success`,
    cancelUrl: `${base}?checkout=cancelled`,
  };
}

/** Start Stripe Checkout on web — redirects browser to Stripe-hosted page. */
export async function startStripeCheckout(): Promise<StripeCheckoutResult> {
  if (!isStripeCheckoutEnabled() || !isApiConfigured()) {
    return { ok: false, reason: 'unavailable' };
  }

  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) {
    return { ok: false, reason: 'unavailable' };
  }

  const { successUrl, cancelUrl } = checkoutReturnUrls();

  try {
    const { checkoutUrl } = await createStripeCheckoutSession({
      sessionId: snap.sessionId,
      deviceInstallId: snap.deviceInstallId,
      billingPeriod: snap.billingPeriod,
      successUrl,
      cancelUrl,
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(checkoutUrl);
      return { ok: true };
    }

    await Linking.openURL(checkoutUrl);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

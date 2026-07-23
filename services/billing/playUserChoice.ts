/**
 * Google Play User Choice Billing bridge.
 *
 * Required for India User Choice Billing compliance: launches Google's choice
 * dialog so the user picks Google Play or alternative billing (Razorpay).
 *
 * When alternative billing is selected, returns externalTransactionToken for
 * Play ExternalTransactions reporting. When Play billing is selected, returns
 * purchaseToken for server-side verification.
 */

import { Platform } from 'react-native';

export type UserChoiceResult =
  | { outcome: 'play_billing'; purchaseToken: string; productId: string }
  | { outcome: 'alternative_billing'; externalTransactionToken: string }
  | { outcome: 'cancelled' }
  | { outcome: 'unavailable'; reason: string };

type NativeModule = {
  isAvailable?: () => boolean;
  launchUserChoiceBilling?: (
    productId: string,
    offerToken?: string,
  ) => Promise<{
    outcome: string;
    externalTransactionToken?: string;
    purchaseToken?: string;
    productId?: string;
  }>;
};

function getNative(): NativeModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('play-user-choice');
    return (mod?.default ?? mod) as NativeModule;
  } catch {
    return null;
  }
}

export function isPlayUserChoiceAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  const native = getNative();
  try {
    return Boolean(native?.isAvailable?.());
  } catch {
    return false;
  }
}

/** Launch Google's user choice billing flow for the given Play product. */
export async function launchPlayUserChoiceBilling(options?: {
  productId?: string;
  offerToken?: string;
}): Promise<UserChoiceResult> {
  if (Platform.OS !== 'android') {
    return { outcome: 'unavailable', reason: 'android_only' };
  }
  const native = getNative();
  if (!native?.launchUserChoiceBilling || !native.isAvailable?.()) {
    return {
      outcome: 'unavailable',
      reason: 'native_module_missing',
    };
  }

  try {
    const productId =
      options?.productId ??
      (process.env.EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY || 'premium_monthly');
    const result = await native.launchUserChoiceBilling(productId, options?.offerToken);
    if (result.outcome === 'alternative_billing' && result.externalTransactionToken) {
      return {
        outcome: 'alternative_billing',
        externalTransactionToken: result.externalTransactionToken,
      };
    }
    if (result.outcome === 'cancelled') {
      return { outcome: 'cancelled' };
    }
    if (result.outcome === 'unavailable') {
      return { outcome: 'unavailable', reason: 'billing_client' };
    }
    if (result.outcome === 'play_billing' && result.purchaseToken) {
      return {
        outcome: 'play_billing',
        purchaseToken: result.purchaseToken,
        productId: result.productId || productId,
      };
    }
    return { outcome: 'unavailable', reason: 'missing_purchase_token' };
  } catch {
    return { outcome: 'cancelled' };
  }
}

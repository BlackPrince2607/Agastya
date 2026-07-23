/**
 * JS entry for Play User Choice Billing.
 * Native Android implementation lives in android/.../PlayUserChoiceModule.kt
 * and is linked on EAS / prebuild. In Expo Go this module reports unavailable.
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativePlayUserChoice = {
  isAvailable: () => boolean;
  launchUserChoiceBilling: (
    productId: string,
    offerToken?: string | null,
  ) => Promise<{ outcome: string; externalTransactionToken?: string }>;
};

let Native: NativePlayUserChoice | null = null;

try {
  if (Platform.OS === 'android') {
    Native = requireNativeModule<NativePlayUserChoice>('PlayUserChoice');
  }
} catch {
  Native = null;
}

export function isAvailable(): boolean {
  try {
    return Boolean(Native?.isAvailable?.());
  } catch {
    return false;
  }
}

export async function launchUserChoiceBilling(
  productId: string,
  offerToken?: string,
): Promise<{ outcome: string; externalTransactionToken?: string }> {
  if (!Native?.launchUserChoiceBilling) {
    return { outcome: 'unavailable' };
  }
  return Native.launchUserChoiceBilling(productId, offerToken ?? null);
}

export default {
  isAvailable,
  launchUserChoiceBilling,
};

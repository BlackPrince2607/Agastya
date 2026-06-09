import { Platform } from 'react-native';

import type { BillingPeriod } from '@/store/sessionStore';
import { isWebDemoMode } from '@/utils/webDemo';

let Purchases: typeof import('react-native-purchases').default | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

let configured = false;

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? 'premium';

export function isRevenueCatConfigured(): boolean {
  if (!Purchases) return false;
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (Platform.OS === 'ios') return Boolean(iosKey);
  if (Platform.OS === 'android') return Boolean(androidKey);
  return false;
}

export function isDevPremiumBypassEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_PREMIUM === 'true';
}

/** Dev bypass, or Vercel web demo (`EXPO_PUBLIC_WEB_DEMO=true`). */
export function isPremiumBypassEnabled(): boolean {
  return isDevPremiumBypassEnabled() || isWebDemoMode();
}

export async function configureRevenueCat() {
  if (!Purchases || configured) return;
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

  try {
    if (Platform.OS === 'ios' && iosKey) {
      Purchases.configure({ apiKey: iosKey });
      configured = true;
    } else if (Platform.OS === 'android' && androidKey) {
      Purchases.configure({ apiKey: androidKey });
      configured = true;
    }
  } catch {
    configured = false;
  }
}

function hasActiveEntitlement(
  info: Awaited<ReturnType<NonNullable<typeof Purchases>['getCustomerInfo']>>,
): boolean {
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
}

export async function refreshPremiumFromStore(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    await configureRevenueCat();
    if (!configured) return false;
    const info = await Purchases.getCustomerInfo();
    return hasActiveEntitlement(info);
  } catch {
    return false;
  }
}

export async function restorePurchasesFromStore(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    await configureRevenueCat();
    if (!configured) return false;
    const info = await Purchases.restorePurchases();
    return hasActiveEntitlement(info);
  } catch {
    return false;
  }
}

export async function purchasePremiumPlan(period: BillingPeriod): Promise<{
  success: boolean;
  entitled: boolean;
}> {
  if (isPremiumBypassEnabled()) {
    return { success: true, entitled: true };
  }

  if (!Purchases) {
    return { success: false, entitled: false };
  }

  try {
    await configureRevenueCat();
    if (!configured) {
      return { success: false, entitled: false };
    }

    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      return { success: false, entitled: false };
    }

    const pkg =
      period === 'annual'
        ? current.annual ?? current.availablePackages.find((p) => p.packageType === 'ANNUAL')
        : current.monthly ??
          current.availablePackages.find((p) => p.packageType === 'MONTHLY') ??
          current.availablePackages[0];

    if (!pkg) {
      return { success: false, entitled: false };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, entitled: hasActiveEntitlement(customerInfo) };
  } catch (e: unknown) {
    const cancelled =
      e &&
      typeof e === 'object' &&
      'userCancelled' in e &&
      (e as { userCancelled?: boolean }).userCancelled === true;
    if (cancelled) {
      return { success: false, entitled: await refreshPremiumFromStore() };
    }
    return { success: false, entitled: false };
  }
}

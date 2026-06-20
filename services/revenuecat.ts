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
let linkedUserId: string | null = null;

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? 'premium';

export function isRevenueCatConfigured(): boolean {
  if (!Purchases) return false;
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (Platform.OS === 'ios') return Boolean(iosKey);
  if (Platform.OS === 'android') return Boolean(androidKey);
  return false;
}

export function isStripeCheckoutEnabled(): boolean {
  return Platform.OS === 'web' && process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_ENABLED === 'true';
}

export function isDevPremiumBypassEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_PREMIUM === 'true';
}

/** Dev bypass, explicit web demo flag, or web when neither Stripe nor RC is configured. */
export function isPremiumBypassEnabled(): boolean {
  if (isDevPremiumBypassEnabled() || isWebDemoMode()) return true;
  if (Platform.OS === 'web' && isStripeCheckoutEnabled()) return false;
  if (Platform.OS === 'web' && !isRevenueCatConfigured()) return true;
  return false;
}

/** True when web users can unlock premium without a real store purchase. */
export function isWebPremiumUnlockAvailable(): boolean {
  return Platform.OS === 'web' && isPremiumBypassEnabled();
}

export async function configureRevenueCat(appUserId?: string) {
  if (!Purchases || !isRevenueCatConfigured()) return;

  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

  try {
    if (!configured) {
      if (Platform.OS === 'ios' && iosKey) {
        Purchases.configure({ apiKey: iosKey, appUserID: appUserId });
        configured = true;
        if (appUserId) linkedUserId = appUserId;
      } else if (Platform.OS === 'android' && androidKey) {
        Purchases.configure({ apiKey: androidKey, appUserID: appUserId });
        configured = true;
        if (appUserId) linkedUserId = appUserId;
      }
    } else if (appUserId && appUserId !== linkedUserId) {
      await Purchases.logIn(appUserId);
      linkedUserId = appUserId;
    }
  } catch {
    configured = false;
  }
}

/** Link RevenueCat customer to session or Supabase user for webhook matching. */
export async function linkRevenueCatUser(appUserId: string): Promise<void> {
  if (!Purchases || !isRevenueCatConfigured() || !appUserId) return;
  await configureRevenueCat(appUserId);
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

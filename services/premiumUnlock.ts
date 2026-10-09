import { Alert, Platform } from 'react-native';

import { generateReport } from '@/services/agastyaApi';
import { AnalyticsEvent, track } from '@/services/analytics';
import {
  getBillingConfig,
  isAndroidBillingAvailable,
  startRazorpayCheckout,
  confirmRazorpayCheckout,
  clearLastCheckoutIntentId,
  verifyPlayPurchase,
  type ConfirmRazorpayOptions,
} from '@/services/billing/billingService';
import { isPlayUserChoiceAvailable, launchPlayUserChoiceBilling } from '@/services/billing/playUserChoice';
import { normalizeFullReport } from '@/services/normalizeReport';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { useSessionStore, type BillingPeriod } from '@/store/sessionStore';

export type UnlockResult =
  | { ok: true; source: 'purchase' | 'restore' | 'razorpay' | 'google_play' }
  | {
      ok: false;
      reason: 'cancelled' | 'unavailable' | 'not_entitled' | 'report_failed' | 'failed' | 'need_sign_in';
      /** Diagnostic code shown to the user / sent to analytics (e.g. `setup_failed:3`). */
      detail?: string;
    };

/** Major-unit price for Meta/Firebase purchase events (INR display prices as fallback). */
const FALLBACK_PLAN_MAJOR: Record<BillingPeriod, number> = {
  monthly: 149,
  annual: 699,
};

async function purchaseValueProps(billingPeriod: BillingPeriod): Promise<{
  value: number;
  currency: string;
  billing_period: BillingPeriod;
}> {
  const config = await getBillingConfig();
  const plan = config?.plans?.[billingPeriod];
  if (plan && typeof plan.amount === 'number') {
    return {
      value: plan.amount / 100,
      currency: plan.currency || config?.currency || 'INR',
      billing_period: billingPeriod,
    };
  }
  return {
    value: FALLBACK_PLAN_MAJOR[billingPeriod] ?? 699,
    currency: config?.currency || 'INR',
    billing_period: billingPeriod,
  };
}

async function syncPremiumFromServer(): Promise<boolean> {
  await restoreSessionFromServer({ force: true });
  return useSessionStore.getState().hasUnlockedPremium;
}

async function materializeFullReport(seed?: string): Promise<boolean> {
  const snap = useSessionStore.getState();
  const targetedSeed = seed ?? snap.readingSeed;
  if (targetedSeed) {
    useSessionStore.getState().setReadingSeed(targetedSeed);
  }

  if (snap.fullReading) return true;
  if (!snap.sessionId || !snap.palmAnalysis) return false;

  try {
    const { getExpoPushToken } = await import('@/services/notifications');
    const expoPushToken = await getExpoPushToken();
    const payload = await generateReport({
      sessionId: snap.sessionId,
      seed: targetedSeed ?? snap.readingSeed,
      palmAnalysis: snap.palmAnalysis,
      focusTopics: snap.focusTopics,
      mode: 'full',
      displayName: snap.userDisplayName,
      gender: snap.userGender,
      expoPushToken,
    });
    useSessionStore.getState().setFullReading(normalizeFullReport(payload));
    track(AnalyticsEvent.REPORT_GENERATED, { mode: 'full' });
    return true;
  } catch {
    return false;
  }
}

async function finalizeAfterEntitlement(
  seed: string | undefined,
  source: Extract<UnlockResult, { ok: true }>['source'],
  trackPurchase: boolean,
): Promise<UnlockResult> {
  const setPremium = useSessionStore.getState().setPremium;
  const billingPeriod = useSessionStore.getState().billingPeriod;
  let serverPremium = await syncPremiumFromServer();
  if (!serverPremium) {
    await new Promise((r) => setTimeout(r, 1500));
    serverPremium = await syncPremiumFromServer();
  }

  const reportOk = await materializeFullReport(seed);
  // Paid users should enter the app even if full report is still generating.
  if (!reportOk && !useSessionStore.getState().fullReading && !serverPremium) {
    setPremium(false);
    return { ok: false, reason: 'report_failed' };
  }

  setPremium(serverPremium || true);
  if (trackPurchase) {
    const valueProps = await purchaseValueProps(billingPeriod);
    track(AnalyticsEvent.PURCHASE_COMPLETED, { source, ...valueProps });
  }
  return { ok: true, source };
}

function promptAdministrativeArea(): Promise<string | null> {
  return new Promise((resolve) => {
    const finish = (code: string | null) => resolve(code);
    const envDefault = (process.env.EXPO_PUBLIC_BILLING_DEFAULT_ADMIN_AREA || '').trim().toUpperCase();
    if (envDefault.length >= 2) {
      finish(envDefault);
      return;
    }
    Alert.alert(
      'Select your state / UT',
      'Required for Google Play alternative billing reporting in India.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => finish(null) },
        { text: 'Karnataka (KA)', onPress: () => finish('KA') },
        { text: 'Maharashtra (MH)', onPress: () => finish('MH') },
        { text: 'Delhi (DL)', onPress: () => finish('DL') },
        { text: 'Tamil Nadu (TN)', onPress: () => finish('TN') },
        { text: 'Other (set EXPO_PUBLIC_BILLING_DEFAULT_ADMIN_AREA)', onPress: () => finish(null) },
      ],
    );
  });
}

/** Razorpay-only: skip Play User Choice and open Payment Link directly. */
export function isRazorpayDirectCheckoutEnabled(): boolean {
  return (process.env.EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS || '').trim() === 'true';
}

async function startDirectRazorpayCheckout(seed: string | undefined): Promise<UnlockResult> {
  const period = useSessionStore.getState().billingPeriod;
  const rz = await startRazorpayCheckout({ period });
  if (!rz.ok) {
    if (rz.reason === 'already_premium') return finalizeAfterEntitlement(seed, 'restore', false);
    return mapCheckoutFailure(rz.reason);
  }
  if (rz.redirecting) {
    return { ok: true, source: 'razorpay' };
  }
  return finalizeAfterEntitlement(seed, 'razorpay', true);
}

function mapCheckoutFailure(
  reason: 'cancelled' | 'unavailable' | 'failed' | 'need_sign_in' | 'already_premium',
): UnlockResult {
  if (reason === 'need_sign_in') return { ok: false, reason: 'need_sign_in' };
  if (reason === 'cancelled') return { ok: false, reason: 'cancelled' };
  return { ok: false, reason: 'failed' };
}

/** Unlock Premium — Android India User Choice → Razorpay or Google Play. */
export async function unlockPremium(options: { seed?: string }): Promise<UnlockResult> {
  const { seed } = options;

  if (Platform.OS !== 'android' || !isAndroidBillingAvailable()) {
    return { ok: false, reason: 'unavailable', detail: 'api_not_configured' };
  }

  if (!useSessionStore.getState().supabaseUserId) {
    return { ok: false, reason: 'need_sign_in' };
  }

  // Expo Go / sideloaded / Razorpay-direct builds: open Payment Link (no User Choice).
  if (isRazorpayDirectCheckoutEnabled()) {
    return startDirectRazorpayCheckout(seed);
  }

  if (!isPlayUserChoiceAvailable()) {
    return { ok: false, reason: 'unavailable', detail: 'native_module_missing' };
  }

  const period = useSessionStore.getState().billingPeriod;
  const productId =
    period === 'annual'
      ? process.env.EXPO_PUBLIC_PLAY_PRODUCT_ANNUAL || 'premium_annual'
      : process.env.EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY || 'premium_monthly';

  const choice = await launchPlayUserChoiceBilling({ productId });

  if (choice.outcome === 'cancelled') {
    return { ok: false, reason: 'cancelled' };
  }
  if (choice.outcome === 'unavailable') {
    const detail = choice.code != null ? `${choice.reason}:${choice.code}` : choice.reason;
    track('play_billing_unavailable', {
      reason: choice.reason,
      code: choice.code ?? null,
      debug_message: choice.debugMessage ?? null,
      product_id: productId,
    });
    return { ok: false, reason: 'unavailable', detail };
  }

  if (choice.outcome === 'alternative_billing') {
    const area = await promptAdministrativeArea();
    if (!area) {
      return { ok: false, reason: 'cancelled' };
    }
    const rz = await startRazorpayCheckout({
      period,
      externalTransactionToken: choice.externalTransactionToken,
      administrativeArea: area,
    });
    if (!rz.ok) {
      if (rz.reason === 'already_premium') return finalizeAfterEntitlement(seed, 'restore', false);
      return mapCheckoutFailure(rz.reason);
    }
    if (rz.redirecting) {
      return { ok: true, source: 'razorpay' };
    }
    return finalizeAfterEntitlement(seed, 'razorpay', true);
  }

  if (choice.outcome === 'play_billing') {
    const verified = await verifyPlayPurchase({
      purchaseToken: choice.purchaseToken,
      productId: choice.productId,
    });
    if (!verified.ok) {
      const serverPremium = await syncPremiumFromServer();
      if (serverPremium) {
        return finalizeAfterEntitlement(seed, 'google_play', true);
      }
      return verified.reason === 'unavailable'
        ? { ok: false, reason: 'unavailable', detail: 'server_verify_unavailable' }
        : { ok: false, reason: 'failed' };
    }
    return finalizeAfterEntitlement(seed, 'google_play', true);
  }

  return { ok: false, reason: 'unavailable' };
}

/** Poll server for premium status (replaces store restore). */
export async function checkPremiumStatus(options: { seed?: string }): Promise<UnlockResult> {
  const { seed } = options;
  // Prefer active Razorpay confirm (covers webhook lag after a completed payment).
  const confirmed = await confirmRazorpayCheckout({});
  if (confirmed.ok) {
    const period = useSessionStore.getState().billingPeriod;
    const valueProps = await purchaseValueProps(period);
    track(AnalyticsEvent.PURCHASE_COMPLETED, {
      source: 'razorpay',
      ...valueProps,
    });
    return finalizeAfterEntitlement(seed, 'razorpay', false);
  }
  const serverPremium = await syncPremiumFromServer();
  if (serverPremium) {
    track(AnalyticsEvent.SUBSCRIPTION_RESTORED, {
      source: 'restore',
      billing_period: useSessionStore.getState().billingPeriod,
    });
    return finalizeAfterEntitlement(seed, 'restore', false);
  }
  return { ok: false, reason: 'not_entitled' };
}

/** Prefer entitlement over report materialization — never strand a paid user. */
export async function finalizeRazorpayCheckout(
  seed?: string,
  confirmOptions?: ConfirmRazorpayOptions,
  opts?: {
    /** User came back without a success redirect: an unpaid checkout means they backed out. */
    abandonIfUnpaid?: boolean;
  },
): Promise<UnlockResult> {
  const setPremium = useSessionStore.getState().setPremium;

  const grantPremium = async (): Promise<UnlockResult> => {
    setPremium(true);
    clearLastCheckoutIntentId();
    // Do not block entry on report generation — home can load while this finishes.
    void materializeFullReport(seed);
    const period = useSessionStore.getState().billingPeriod;
    const valueProps = await purchaseValueProps(period);
    track(AnalyticsEvent.PURCHASE_COMPLETED, {
      source: 'razorpay',
      ...valueProps,
    });
    return { ok: true, source: 'razorpay' };
  };

  // Prefer active confirm (does not depend on webhook delivery timing).
  const confirmed = await confirmRazorpayCheckout(confirmOptions ?? {});
  if (confirmed.ok) {
    return grantPremium();
  }
  if (confirmed.status === 'not_found') {
    if (await syncPremiumFromServer()) return grantPremium();
    return { ok: false, reason: 'not_entitled' };
  }
  if (opts?.abandonIfUnpaid && confirmed.status === 'created') {
    if (await syncPremiumFromServer()) return grantPremium();
    clearLastCheckoutIntentId();
    return { ok: false, reason: 'cancelled', detail: 'checkout_not_paid' };
  }

  // Fallback: webhook may still be catching up — retry confirm + bootstrap.
  // Keep each call shorter; paywall polls multiple times after browser return.
  const waits = [0, 1200, 2400, 3600];
  let entitled = false;
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const retry = await confirmRazorpayCheckout(confirmOptions ?? {});
    if (retry.ok) {
      entitled = true;
      break;
    }
    entitled = await syncPremiumFromServer();
    if (entitled || retry.status === 'not_found') break;
  }
  if (!entitled) {
    // Already premium locally (e.g. race with another confirm) — still succeed.
    if (useSessionStore.getState().hasUnlockedPremium) {
      clearLastCheckoutIntentId();
      return { ok: true, source: 'razorpay' };
    }
    return { ok: false, reason: 'not_entitled' };
  }
  return grantPremium();
}

/** @deprecated Use unlockPremium */
export async function unlockPremiumFromStore(options: {
  mode: 'purchase' | 'restore';
  seed?: string;
}): Promise<UnlockResult> {
  if (options.mode === 'restore') {
    return checkPremiumStatus({ seed: options.seed });
  }
  return unlockPremium({ seed: options.seed });
}

/** @deprecated Use finalizeRazorpayCheckout */
export async function finalizeHostedCheckout(
  seed?: string,
  _provider: 'razorpay' = 'razorpay',
): Promise<UnlockResult> {
  return finalizeRazorpayCheckout(seed);
}

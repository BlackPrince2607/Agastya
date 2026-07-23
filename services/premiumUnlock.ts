import { Alert, Platform } from 'react-native';

import { generateReport } from '@/services/agastyaApi';
import { AnalyticsEvent, track } from '@/services/analytics';
import {
  isAndroidBillingAvailable,
  startRazorpayCheckout,
  verifyPlayPurchase,
} from '@/services/billing/billingService';
import { isPlayUserChoiceAvailable, launchPlayUserChoiceBilling } from '@/services/billing/playUserChoice';
import { normalizeFullReport } from '@/services/normalizeReport';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { useSessionStore } from '@/store/sessionStore';

export type UnlockResult =
  | { ok: true; source: 'purchase' | 'restore' | 'razorpay' | 'google_play' }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'not_entitled' | 'report_failed' | 'failed' };

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
    const payload = await generateReport({
      sessionId: snap.sessionId,
      seed: targetedSeed ?? snap.readingSeed,
      palmAnalysis: snap.palmAnalysis,
      focusTopics: snap.focusTopics,
      mode: 'full',
      displayName: snap.userDisplayName,
      gender: snap.userGender,
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
  source: UnlockResult extends { ok: true } ? UnlockResult['source'] : never,
  trackPurchase: boolean,
): Promise<UnlockResult> {
  const setPremium = useSessionStore.getState().setPremium;
  let serverPremium = await syncPremiumFromServer();
  if (!serverPremium) {
    await new Promise((r) => setTimeout(r, 1500));
    serverPremium = await syncPremiumFromServer();
  }

  const reportOk = await materializeFullReport(seed);
  if (!reportOk && !useSessionStore.getState().fullReading) {
    if (!serverPremium) setPremium(false);
    return { ok: false, reason: 'report_failed' };
  }

  setPremium(serverPremium || true);
  if (trackPurchase) {
    track(AnalyticsEvent.PURCHASE_COMPLETED, { source });
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

/** DEBUG-only: open Razorpay without Play User Choice (local E2E testing). */
function isRazorpayTestBypassEnabled(): boolean {
  return (process.env.EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS || '').trim() === 'true';
}

/** Unlock Premium — Android India User Choice → Razorpay or Google Play. */
export async function unlockPremium(options: { seed?: string }): Promise<UnlockResult> {
  const { seed } = options;

  if (Platform.OS !== 'android' || !isAndroidBillingAvailable()) {
    return { ok: false, reason: 'unavailable' };
  }

  const period = useSessionStore.getState().billingPeriod;

  // Minimal test path: skip Play User Choice when explicitly enabled for local E2E.
  if (isRazorpayTestBypassEnabled()) {
    const rz = await startRazorpayCheckout({ period });
    if (!rz.ok) {
      return { ok: false, reason: rz.reason === 'cancelled' ? 'cancelled' : 'failed' };
    }
    if (rz.redirecting) {
      return { ok: true, source: 'razorpay' };
    }
    return finalizeAfterEntitlement(seed, 'razorpay', true);
  }

  if (!isPlayUserChoiceAvailable()) {
    return { ok: false, reason: 'unavailable' };
  }

  const productId =
    period === 'annual'
      ? process.env.EXPO_PUBLIC_PLAY_PRODUCT_ANNUAL || 'premium_annual'
      : process.env.EXPO_PUBLIC_PLAY_PRODUCT_MONTHLY || 'premium_monthly';

  const choice = await launchPlayUserChoiceBilling({ productId });

  if (choice.outcome === 'cancelled') {
    return { ok: false, reason: 'cancelled' };
  }
  if (choice.outcome === 'unavailable') {
    return { ok: false, reason: 'unavailable' };
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
      return { ok: false, reason: rz.reason === 'cancelled' ? 'cancelled' : 'failed' };
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
      return { ok: false, reason: verified.reason === 'unavailable' ? 'unavailable' : 'failed' };
    }
    return finalizeAfterEntitlement(seed, 'google_play', true);
  }

  return { ok: false, reason: 'unavailable' };
}

/** Poll server for premium status (replaces store restore). */
export async function checkPremiumStatus(options: { seed?: string }): Promise<UnlockResult> {
  const { seed } = options;
  const serverPremium = await syncPremiumFromServer();
  if (serverPremium) {
    return finalizeAfterEntitlement(seed, 'restore', false);
  }
  return { ok: false, reason: 'not_entitled' };
}

/** After Razorpay checkout success deep link — poll server for isPremium. */
export async function finalizeRazorpayCheckout(seed?: string): Promise<UnlockResult> {
  const setPremium = useSessionStore.getState().setPremium;

  const waits = [0, 1500, 2000, 3000, 4000, 5000, 6000, 8000, 10000];
  let entitled = false;
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    entitled = await syncPremiumFromServer();
    if (entitled) break;
  }
  if (!entitled) {
    return { ok: false, reason: 'not_entitled' };
  }
  const reportOk = await materializeFullReport(seed);
  if (!reportOk && !useSessionStore.getState().fullReading) {
    return { ok: false, reason: 'report_failed' };
  }
  setPremium(true);
  track(AnalyticsEvent.PURCHASE_COMPLETED, { source: 'razorpay' });
  return { ok: true, source: 'razorpay' };
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

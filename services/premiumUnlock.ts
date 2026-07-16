import { generateReport } from '@/services/agastyaApi';
import { AnalyticsEvent, track } from '@/services/analytics';
import { normalizeFullReport } from '@/services/normalizeReport';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import {
  isRevenueCatConfigured,
  isStripeCheckoutEnabled,
  purchasePremiumPlan,
  refreshPremiumFromStore,
  restorePurchasesFromStore,
} from '@/services/revenuecat';
import { startStripeCheckout } from '@/services/stripeBilling';
import { useSessionStore } from '@/store/sessionStore';

export type UnlockResult =
  | { ok: true; source: 'purchase' | 'restore' | 'entitlement' | 'stripe' }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'not_entitled' | 'report_failed' };

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

/** Subscribe or restore — sets premium when store/webhook confirms entitlement. */
export async function unlockPremiumFromStore(options: {
  mode: 'purchase' | 'restore';
  seed?: string;
}): Promise<UnlockResult> {
  const { mode, seed } = options;
  const setPremium = useSessionStore.getState().setPremium;

  if (isStripeCheckoutEnabled() && mode === 'purchase') {
    const checkout = await startStripeCheckout();
    if (checkout.ok) {
      return { ok: true, source: 'stripe' };
    }
    if (checkout.reason === 'cancelled') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'unavailable' };
  }

  if (!isRevenueCatConfigured()) {
    return { ok: false, reason: 'unavailable' };
  }

  let entitled = false;

  if (mode === 'restore') {
    entitled = await restorePurchasesFromStore();
  } else {
    const purchase = await purchasePremiumPlan(useSessionStore.getState().billingPeriod);
    entitled = purchase.entitled;
    if (!purchase.success && !entitled) {
      return { ok: false, reason: 'cancelled' };
    }
  }

  if (!entitled) {
    entitled = await refreshPremiumFromStore();
  }

  if (!entitled) {
    return { ok: false, reason: 'not_entitled' };
  }

  // Prefer server isPremium (webhook). Fall back to store entitlement if webhook lags.
  let serverPremium = await syncPremiumFromServer();
  if (!serverPremium && entitled) {
    // Brief wait for webhook, then re-check once.
    await new Promise((r) => setTimeout(r, 1500));
    serverPremium = await syncPremiumFromServer();
  }

  const reportOk = await materializeFullReport(seed);
  if (!reportOk && !useSessionStore.getState().fullReading) {
    setPremium(false);
    return { ok: false, reason: 'report_failed' };
  }

  setPremium(serverPremium || entitled);
  if (mode === 'purchase') {
    track(AnalyticsEvent.PURCHASE_COMPLETED, { source: 'purchase' });
  }
  return { ok: true, source: mode === 'restore' ? 'restore' : 'purchase' };
}

/** After Stripe Checkout success redirect — poll server for isPremium. */
export async function finalizeStripeCheckout(seed?: string): Promise<UnlockResult> {
  const setPremium = useSessionStore.getState().setPremium;
  const entitled = await syncPremiumFromServer();
  if (!entitled) {
    return { ok: false, reason: 'not_entitled' };
  }
  const reportOk = await materializeFullReport(seed);
  if (!reportOk && !useSessionStore.getState().fullReading) {
    setPremium(false);
    return { ok: false, reason: 'report_failed' };
  }
  setPremium(true);
  track(AnalyticsEvent.PURCHASE_COMPLETED, { source: 'stripe' });
  return { ok: true, source: 'stripe' };
}

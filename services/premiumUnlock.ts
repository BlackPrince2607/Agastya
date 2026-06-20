import { generateReport } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { normalizeFullReport } from '@/services/normalizeReport';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import {
  isPremiumBypassEnabled,
  isRevenueCatConfigured,
  isStripeCheckoutEnabled,
  purchasePremiumPlan,
  refreshPremiumFromStore,
  restorePurchasesFromStore,
} from '@/services/revenuecat';
import { startStripeCheckout } from '@/services/stripeBilling';
import { useSessionStore } from '@/store/sessionStore';

export type UnlockResult =
  | { ok: true; source: 'purchase' | 'restore' | 'entitlement' | 'dev' | 'stripe' }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'not_entitled' };

async function syncPremiumFromServer(): Promise<boolean> {
  const restored = await restoreSessionFromServer({ force: true });
  if (restored && useSessionStore.getState().hasUnlockedPremium) {
    return true;
  }
  return useSessionStore.getState().hasUnlockedPremium;
}

async function materializeFullReport(seed?: string) {
  const snap = useSessionStore.getState();
  const targetedSeed = seed ?? snap.readingSeed;
  if (targetedSeed) {
    useSessionStore.getState().setReadingSeed(targetedSeed);
  }

  if (!snap.sessionId || !snap.palmAnalysis) return;

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
  } catch {
    /* offline tolerated */
  }
}

/** Subscribe or restore — sets premium when store/webhook confirms entitlement (or dev bypass). */
export async function unlockPremiumFromStore(options: {
  mode: 'purchase' | 'restore';
  seed?: string;
}): Promise<UnlockResult> {
  const { mode, seed } = options;
  const setPremium = useSessionStore.getState().setPremium;

  if (isPremiumBypassEnabled()) {
    setPremium(true);
    await materializeFullReport(seed);
    track('premium_unlock_dev');
    return { ok: true, source: 'dev' };
  }

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

  const serverPremium = await syncPremiumFromServer();
  setPremium(serverPremium || entitled);
  await materializeFullReport(seed);
  track('premium_unlock_ok', { mode });
  return { ok: true, source: mode === 'restore' ? 'restore' : 'purchase' };
}

/** After Stripe Checkout success redirect — poll server for isPremium. */
export async function finalizeStripeCheckout(seed?: string): Promise<UnlockResult> {
  const setPremium = useSessionStore.getState().setPremium;
  const entitled = await syncPremiumFromServer();
  if (!entitled) {
    return { ok: false, reason: 'not_entitled' };
  }
  setPremium(true);
  await materializeFullReport(seed);
  track('premium_unlock_ok', { mode: 'stripe' });
  return { ok: true, source: 'stripe' };
}

/**
 * DEV / prototype unlock — delete with DevPremiumPanel when billing is live.
 * Available in __DEV__ only on this branch (production uses Razorpay + Play).
 */

import { generateReport } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { normalizeFullReport } from '@/services/normalizeReport';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useSessionStore } from '@/store/sessionStore';

export type DevPremiumStatus = {
  premium: boolean;
  previewSections: number;
  fullSections: number;
};

/** True in development builds for UI testing without real payments. */
export function isPrototypePremiumUnlockEnabled(): boolean {
  if (!__DEV__) return false;
  // When testing live Razorpay (Option B bypass), never use local prototype unlock.
  if ((process.env.EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS || '').trim() === 'true') {
    return false;
  }
  return true;
}

export function devPremiumStatus(): DevPremiumStatus {
  const snap = useSessionStore.getState();
  return {
    premium: snap.hasUnlockedPremium,
    previewSections: snap.previewReading?.sections.length ?? 0,
    fullSections: snap.fullReading?.sections.length ?? 0,
  };
}

async function materializeDevFullReading(): Promise<number> {
  const snap = useSessionStore.getState();
  const seed = snap.readingSeed || 'dev-seed';

  if (isApiConfigured() && snap.sessionId && snap.palmAnalysis) {
    try {
      const payload = await generateReport({
        sessionId: snap.sessionId,
        seed,
        palmAnalysis: snap.palmAnalysis,
        focusTopics: snap.focusTopics,
        mode: 'full',
        displayName: snap.userDisplayName,
        gender: snap.userGender,
      });
      const reading = normalizeFullReport(payload);
      snap.setFullReading(reading);
      return reading.sections.length;
    } catch {
      /* fall through to local simulated report */
    }
  }

  const reading = buildSimulatedReading(seed, snap.focusTopics, snap.palmAnalysis);
  snap.setFullReading(reading);
  return reading.sections.length;
}

/** Turn on premium locally and populate a full report for UI testing / prototype APKs. */
export async function devUnlockPremium(): Promise<{ ok: true; sections: number } | { ok: false; reason: string }> {
  if (!isPrototypePremiumUnlockEnabled()) {
    return { ok: false, reason: 'Prototype unlock is only available in development builds.' };
  }

  const snap = useSessionStore.getState();
  if (!snap.palmAnalysis && !snap.previewReading) {
    return { ok: false, reason: 'Complete a palm scan first so there is reading data to unlock.' };
  }

  snap.setPremium(true);
  const sections = await materializeDevFullReading();
  return { ok: true, sections };
}

/** Reset premium locally so you can test the free / preview experience again. */
export function devLockPremium(): void {
  if (!isPrototypePremiumUnlockEnabled()) return;
  const snap = useSessionStore.getState();
  snap.setPremium(false);
  snap.setFullReading(null);
  useSessionStore.setState({ predictions: null });
}

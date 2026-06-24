import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isAuthBypassEnabled, isDevPremiumFlagEnabled } from '@/services/authConfig';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useSessionStore } from '@/store/sessionStore';

const DEV_PALM: PalmAnalysisDto = {
  life_line: 'strong',
  heart_line: 'curved',
  head_line: 'long',
  personality: 'visionary',
  traits: ['independent', 'overthinker', 'curious'],
  analysis_source: 'fallback',
};

/** Dev-only: skip sign-in + paywall and seed a reading so the main app opens immediately. */
export function isDevQuickAccessEnabled(): boolean {
  return __DEV__ && isAuthBypassEnabled && isDevPremiumFlagEnabled();
}

function hasRitualReading(): boolean {
  const s = useSessionStore.getState();
  return Boolean(s.previewReading || s.fullReading || s.palmAnalysis);
}

/** Seed guest profile + reading when dev flags are on and local state is empty. */
export function applyDevQuickAccess(): void {
  if (!isDevQuickAccessEnabled()) return;

  const snap = useSessionStore.getState();
  const seed = snap.readingSeed || 'dev-access';
  const focus = snap.focusTopics.length ? snap.focusTopics : (['growth', 'love'] as const);

  if (!hasRitualReading()) {
    const reading = buildSimulatedReading(seed, [...focus]);
    useSessionStore.setState({
      userDisplayName: snap.userDisplayName ?? 'Guest',
      userGender: snap.userGender ?? 'prefer_not',
      focusTopics: [...focus],
      palmAnalysis: DEV_PALM,
      previewReading: reading,
      fullReading: reading,
      hasUnlockedPremium: true,
      hasEnteredMain: true,
    });
    if (__DEV__) {
      console.log('[Agastya dev] Quick access — guest reading seeded, main app unlocked');
    }
    return;
  }

  if (!snap.hasUnlockedPremium) {
    useSessionStore.getState().setPremium(true);
  }
  if (!snap.hasEnteredMain) {
    useSessionStore.getState().setEnteredMain(true);
  }
  if (__DEV__ && (!snap.hasUnlockedPremium || !snap.hasEnteredMain)) {
    console.log('[Agastya dev] Quick access — restored main app access');
  }
}

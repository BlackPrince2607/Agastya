/**
 * DEV / prototype — delete with services/devPremium.ts when billing is live.
 * Shows when Metro __DEV__ is on, or when store billing is not configured.
 */

import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { CosmicButton } from '@/components/primitives';
import { GlassCard } from '@/components/ui';
import {
  devLockPremium,
  devPremiumStatus,
  devUnlockPremium,
  isPrototypePremiumUnlockEnabled,
} from '@/services/devPremium';
import { useSessionStore } from '@/store/sessionStore';
import { enterMainApp } from '@/utils/navigationFlow';

type DevPremiumPanelProps = {
  /** Show a shortcut to the full report screen after unlock. */
  showOpenReport?: boolean;
};

export function DevPremiumPanel({ showOpenReport = false }: DevPremiumPanelProps) {
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const fullSections = useSessionStore((s) => s.fullReading?.sections.length ?? 0);
  const previewSections = useSessionStore((s) => s.previewReading?.sections.length ?? 0);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(() => devPremiumStatus(), []);

  if (!isPrototypePremiumUnlockEnabled()) {
    return null;
  }

  const handleUnlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await devUnlockPremium();
      refreshStatus();
      if (result.ok) {
        Alert.alert(
          'Full access unlocked',
          `Report ready with ${result.sections} chapters. You can enter the app now.`,
          showOpenReport
            ? [
                { text: 'Enter app', onPress: () => enterMainApp() },
                { text: 'Open report', onPress: () => router.push('/report') },
              ]
            : [
                { text: 'Enter app', onPress: () => enterMainApp() },
                { text: 'OK' },
              ],
        );
      } else {
        Alert.alert('Unlock failed', result.reason);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLock = () => {
    devLockPremium();
    refreshStatus();
    Alert.alert('Premium locked', 'Back to free / preview mode on this device.');
  };

  return (
    <GlassCard className="w-full border border-amber-400/35 bg-amber-500/[0.06] p-4">
      <Text className="font-label text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/90">
        Prototype unlock
      </Text>
      <Text className="mt-2 font-body text-[13px] leading-5 text-on-surface-variant">
        Premium: {premium ? 'on' : 'off'} · Preview chapters: {previewSections} · Full chapters:{' '}
        {fullSections}
      </Text>
      <View className="mt-3 gap-2">
        {!premium ? (
          <CosmicButton
            variant="ghost"
            label={busy ? 'Unlocking…' : 'Unlock full access'}
            disabled={busy}
            onPress={() => void handleUnlock()}
          />
        ) : (
          <>
            <CosmicButton variant="ghost" label="Enter Agastya" onPress={() => enterMainApp()} />
            <CosmicButton variant="ghost" label="Lock premium" onPress={handleLock} />
          </>
        )}
        {showOpenReport && premium ? (
          <CosmicButton variant="ghost" label="Open palm report" onPress={() => router.push('/report')} />
        ) : null}
      </View>
    </GlassCard>
  );
}

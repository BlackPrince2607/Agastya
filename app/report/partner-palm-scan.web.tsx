import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { CosmicButton } from '@/components/primitives';
import { Icon } from '@/components/ui';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImageWeb } from '@/utils/pickPalmImageWeb';
import { deferRouterPush } from '@/utils/routerDefer';

function HandToggle({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="min-w-[48%] flex-1">
      <View
        className={
          selected
            ? 'rounded-full border border-stitch-magenta bg-stitch-magenta/15 px-4 py-3 shadow-glow'
            : 'rounded-full border border-white/15 bg-black/45 px-4 py-3'
        }>
        <Text className="text-center font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
          {label}
        </Text>
        <Text className="mt-1 text-center font-inter text-[11px] text-md-on-surface-variant">{sub}</Text>
      </View>
    </Pressable>
  );
}

/** Web: upload partner palm photo for compatibility matching. */
export default function PartnerPalmScanWebScreen() {
  const partnerPalmScanHand = useSessionStore((s) => s.partnerPalmScanHand);
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const [uploadBusy, setUploadBusy] = useState(false);

  const uploadAndContinue = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const hand: PalmScanHand = partnerPalmScanHand ?? 'right';
      const seed = `partner-${hand}-${Date.now()}`;
      const base64 = await pickPalmImageWeb();
      if (!base64) {
        Alert.alert('No photo selected', 'Choose a clear palm photo to continue.');
        return;
      }
      setPartnerPalmCaptureBase64(base64);
      deferRouterPush({
        pathname: '/report/partner-palm-analysis' as never,
        params: { seed },
      });
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 px-6 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
            <Icon name="chevron_left" size={24} color="#22d3ee" />
          </Pressable>
          <Text className="min-w-0 flex-1 font-headline text-[20px] text-on-surface" numberOfLines={1}>
            Upload partner&apos;s palm
          </Text>
        </View>

        <View className="mt-6 gap-5">
          <Text className="font-inter text-[15px] leading-6 text-md-on-surface-variant">
            Choose a clear photo of your partner&apos;s open palm. Good lighting helps us read the lines accurately.
          </Text>

          <View className="flex-row gap-3">
            <HandToggle
              label="Left hand"
              sub="Receptive energy"
              selected={partnerPalmScanHand === 'left'}
              onPress={() => setPartnerPalmScanHand('left')}
            />
            <HandToggle
              label="Right hand"
              sub="Active energy"
              selected={partnerPalmScanHand === 'right' || partnerPalmScanHand === null}
              onPress={() => setPartnerPalmScanHand('right')}
            />
          </View>

          <View className="mt-2">
            <CosmicButton
              gradient="nebulaMd3"
              label={uploadBusy ? 'Opening…' : 'Choose palm photo'}
              disabled={uploadBusy}
              onPress={() => void uploadAndContinue()}
            />
          </View>
        </View>
      </View>
    </CosmicScreen>
  );
}

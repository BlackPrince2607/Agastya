import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
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

/** Web: file upload instead of native camera. */
export default function PalmScanWebScreen() {
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const [uploadBusy, setUploadBusy] = useState(false);

  const uploadAndContinue = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const hand: PalmScanHand = palmScanHand ?? 'right';
      const seed = `${hand}-${Date.now()}`;
      const base64 = await pickPalmImageWeb();
      if (!base64) {
        Alert.alert('No photo selected', 'Choose a clear palm photo to continue.');
        return;
      }
      setPalmCaptureBase64(base64);
      deferRouterPush({
        pathname: '/onboarding/analysis',
        params: { seed },
      });
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <PalmScanBriefing
      primaryLabel={uploadBusy ? 'Opening…' : 'Upload palm photo'}
      primaryIcon="image"
      onPrimaryPress={() => void uploadAndContinue()}
      beforePrimary={
        <View className="flex-row gap-3">
          <HandToggle
            label="Left hand"
            sub="Often receptive energy"
            selected={palmScanHand === 'left'}
            onPress={() => setPalmScanHand('left')}
          />
          <HandToggle
            label="Right hand"
            sub="Often active energy"
            selected={palmScanHand === 'right' || palmScanHand === null}
            onPress={() => setPalmScanHand('right')}
          />
        </View>
      }
    />
  );
}

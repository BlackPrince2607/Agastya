import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { CosmicButton } from '@/components/primitives';
import { PAGE_PADDING } from '@/constants/layout';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { assessPalmCaptureQuality, confirmSoftQualityOrProceed } from '@/utils/palmCaptureQuality';
import { deferRouterPush } from '@/utils/routerDefer';

/** Web: upload partner palm photo — goes straight to analysis. */
export default function PartnerPalmScanWebScreen() {
  const partnerPalmScanHand = useSessionStore((s) => s.partnerPalmScanHand);
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const setPartnerPalmCaptureLandmarks = useSessionStore((s) => s.setPartnerPalmCaptureLandmarks);
  const [uploadBusy, setUploadBusy] = useState(false);

  const hand: PalmScanHand = partnerPalmScanHand ?? 'right';

  const uploadAndAnalyze = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;

      const quality = assessPalmCaptureQuality(base64);
      const proceed = await confirmSoftQualityOrProceed(quality, Alert.alert);
      if (!proceed) return;

      const seed = `partner-${hand}-${Date.now()}`;
      setPartnerPalmScanHand(hand);
      setPartnerPalmCaptureBase64(base64);
      setPartnerPalmCaptureLandmarks(null, null);
      useSessionStore.getState().setPartnerPalmAnalysis(null);
      deferRouterPush({
        pathname: '/report/partner-palm-analysis' as never,
        params: { seed },
      });
    } catch {
      Alert.alert('Upload failed', 'We couldn’t read that image. Try a JPG or PNG of their open palm.');
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 pb-8 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
        <View className="flex-row items-center gap-3">
          <BackButton />
          <Text className="min-w-0 flex-1 font-headline text-[20px] text-on-surface" numberOfLines={1}>
            Upload partner&apos;s palm
          </Text>
        </View>

        <View className="mt-6 gap-5">
          <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
            Choose a clear photo of your partner&apos;s open {hand} palm. Good lighting helps us read the lines accurately.
          </Text>

          <View className="items-center py-2">
            <PalmScanFrame size={260} hand={hand} showScanLine={false} />
          </View>

          <HandToggleRow hand={partnerPalmScanHand} onSelect={setPartnerPalmScanHand} />

          <CosmicButton
            gradient="nebulaMd3"
            label={uploadBusy ? 'Opening…' : 'Choose palm photo'}
            disabled={uploadBusy}
            onPress={() => void uploadAndAnalyze()}
          />
        </View>
      </View>
    </CosmicScreen>
  );
}

import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { PalmCaptureReview } from '@/components/onboarding/PalmCaptureReview';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { CosmicButton } from '@/components/primitives';
import { PAGE_PADDING } from '@/constants/layout';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

type ScanStep = 'upload' | 'review';

/** Web: upload partner palm photo for compatibility matching. */
export default function PartnerPalmScanWebScreen() {
  const partnerPalmScanHand = useSessionStore((s) => s.partnerPalmScanHand);
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const setPartnerPalmCaptureLandmarks = useSessionStore((s) => s.setPartnerPalmCaptureLandmarks);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<ScanStep>('upload');
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);

  const hand: PalmScanHand = partnerPalmScanHand ?? 'right';

  const uploadAndReview = async () => {
    if (uploadBusy || confirming) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      setPreviewBase64(base64);
      setStep('review');
    } catch {
      Alert.alert('Upload failed', 'We couldn’t read that image. Try a JPG or PNG of their open palm.');
    } finally {
      setUploadBusy(false);
    }
  };

  const confirmReview = (
    landmarks: Array<[number, number]>,
    source: 'mediapipe',
    palm: PalmAnalysisDto,
  ) => {
    if (!previewBase64 || confirming) return;
    setConfirming(true);
    const seed = `partner-${hand}-${Date.now()}`;
    setPartnerPalmScanHand(hand);
    setPartnerPalmCaptureBase64(previewBase64);
    setPartnerPalmCaptureLandmarks(landmarks, source);
    useSessionStore.getState().setPartnerPalmAnalysis(palm);
    deferRouterPush({
      pathname: '/report/partner-palm-analysis' as never,
      params: { seed },
    });
  };

  if (step === 'review' && previewBase64) {
    return (
      <PalmCaptureReview
        base64={previewBase64}
        hand={hand}
        variant="partner"
        showOnboardingHeader={false}
        confirming={confirming}
        onRetake={() => {
          setPreviewBase64(null);
          setConfirming(false);
          setStep('upload');
        }}
        onConfirm={confirmReview}
      />
    );
  }

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
            onPress={() => void uploadAndReview()}
          />
        </View>
      </View>
    </CosmicScreen>
  );
}

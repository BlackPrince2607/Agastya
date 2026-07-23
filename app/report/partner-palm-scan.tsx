import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmCaptureReview } from '@/components/onboarding/PalmCaptureReview';
import { PalmScanCoachingTips } from '@/components/onboarding/PalmScanCoachingTips';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { CosmicButton, GradientText } from '@/components/primitives';
import { PAGE_PADDING } from '@/constants/layout';
import { colors } from '@/constants/theme';
import {
  CAMERA_PERMISSION_LOADING,
  GALLERY_OPENING,
  PALM_CAMERA_CAPTURING,
  PALM_CAMERA_COACHING,
  PALM_CAPTURE_FAILED,
} from '@/constants/userCopy';
import { LoadingBlock } from '@/components/feedback';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

type ScanStep = 'camera' | 'review';

/** Scan a partner's palm for compatibility matching. */
export default function PartnerPalmScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [uploadBusy, setUploadBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<ScanStep>('camera');
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>(
    () => useSessionStore.getState().partnerPalmScanHand ?? 'right',
  );
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const setPartnerPalmCaptureLandmarks = useSessionStore((s) => s.setPartnerPalmCaptureLandmarks);
  const camRef = useRef<CameraView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const frameSize = Math.min(windowWidth - PAGE_PADDING * 2 - 8, 300);

  const hand = selectedHand;

  const goToReview = (base64: string) => {
    setPreviewBase64(base64);
    setStep('review');
  };

  const uploadFromGallery = async () => {
    if (uploadBusy || capturing) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      goToReview(base64);
    } finally {
      setUploadBusy(false);
    }
  };

  const confirmReview = (
    landmarks: Array<[number, number]>,
    source: 'mediapipe' | 'roi_estimate',
  ) => {
    if (!previewBase64 || confirming) return;
    setConfirming(true);
    const seed = `partner-${hand}-${Date.now()}`;
    setPartnerPalmScanHand(hand);
    setPartnerPalmCaptureBase64(previewBase64);
    setPartnerPalmCaptureLandmarks(landmarks, source);
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
          setStep('camera');
        }}
        onConfirm={confirmReview}
      />
    );
  }

  if (!permission) {
    return (
      <CosmicScreen insetTop={false}>
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message={CAMERA_PERMISSION_LOADING} />
        </View>
      </CosmicScreen>
    );
  }

  if (!permission.granted) {
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View className="flex-1 justify-center gap-8" style={{ paddingHorizontal: PAGE_PADDING, paddingBottom: 32 }}>
            <View className="flex-row items-center gap-3">
              <BackButton />
              <Text className="font-headline text-[20px] text-on-surface">Partner palm scan</Text>
            </View>
            <View className="gap-3">
              <GradientText className="font-label text-[12px] uppercase tracking-[0.4em] text-cyan">
                Camera access
              </GradientText>
              <Text className="font-headline text-[26px] leading-8 text-on-surface">
                Camera access for their palm scan
              </Text>
              <Text className="font-body text-[15px] leading-7 text-on-surface-variant">
                Ask your partner for soft light and a steady, open palm. We only capture the hand.
              </Text>
            </View>
            <View className="gap-3">
              <CosmicButton variant="ghost" label="Allow camera" onPress={() => requestPermission()} />
              <CosmicButton variant="ghost" label="Upload from gallery instead" onPress={() => void uploadFromGallery()} />
            </View>
          </View>
        </View>
      </CosmicScreen>
    );
  }

  const startScan = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.85,
      });
      if (!photo?.base64) {
        Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
        return;
      }
      void triggerLightTap();
      goToReview(photo.base64);
    } catch {
      Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <CosmicScreen insetTop={false}>
      <View className="flex-1">
        <CameraView ref={camRef} facing="back" style={{ flex: 1 }} />
        <View className="absolute inset-0 bg-black/45" pointerEvents="box-none">
          <CosmicDotGrid />
          <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
            <View className="flex-1 pb-4 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
              <View className="flex-row items-center gap-3">
                <BackButton />
                <Text className="min-w-0 flex-1 font-headline text-[20px] text-on-surface" numberOfLines={1}>
                  Scan partner&apos;s {hand} palm
                </Text>
              </View>

              <Text className="mt-4 font-body text-[14px] leading-6 text-on-surface-variant">
                Center their palm inside the guide. Hold steady for a clear read.
              </Text>
              <Text className="mt-1 font-body text-[12px] leading-5 text-on-surface-variant/80">
                {PALM_CAMERA_COACHING}
              </Text>

              <View className="flex-1 items-center justify-center py-4" pointerEvents="none">
                <PalmScanFrame hand={hand} size={frameSize} cornerColor={colors.primary} />
              </View>

              <View className="gap-4">
                <PalmScanCoachingTips compact />
                <HandToggleRow hand={selectedHand} onSelect={setSelectedHand} compact />
                <CosmicButton
                  gradient="nebulaMd3"
                  label={capturing ? PALM_CAMERA_CAPTURING : 'Capture palm'}
                  disabled={capturing}
                  onPress={() => void startScan()}
                />
                <CosmicButton
                  variant="ghost"
                  label={uploadBusy ? GALLERY_OPENING : 'Upload from gallery'}
                  disabled={uploadBusy || capturing}
                  onPress={() => void uploadFromGallery()}
                />
                <Text className="text-center font-body text-[12px] leading-5 text-cyan/80">
                  Palm data is analyzed for matching only and stays on this device.
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </CosmicScreen>
  );
}

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { LivePalmCaptureGuide } from '@/components/onboarding/LivePalmCaptureGuide';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { CosmicButton, GradientText } from '@/components/primitives';
import { PAGE_PADDING } from '@/constants/layout';
import { colors } from '@/constants/theme';
import {
  CAMERA_PERMISSION_LOADING,
  GALLERY_OPENING,
  PALM_CAMERA_CAPTURING,
  PALM_CAMERA_MANUAL,
  PALM_CAPTURE_FAILED,
} from '@/constants/userCopy';
import { LoadingBlock } from '@/components/feedback';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { assessPalmCaptureQuality, confirmSoftQualityOrProceed } from '@/utils/palmCaptureQuality';
import { deferRouterPush } from '@/utils/routerDefer';

/** Scan a partner's palm for compatibility matching — capture → analysis, no review. */
export default function PartnerPalmScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [uploadBusy, setUploadBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
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

  const goToAnalysis = (base64: string) => {
    const seed = `partner-${hand}-${Date.now()}`;
    setPartnerPalmScanHand(hand);
    setPartnerPalmCaptureBase64(base64);
    setPartnerPalmCaptureLandmarks(null, null);
    useSessionStore.getState().setPartnerPalmAnalysis(null);
    deferRouterPush({
      pathname: '/report/partner-palm-analysis' as never,
      params: { seed },
    });
  };

  const submitCapture = async (base64: string) => {
    const quality = assessPalmCaptureQuality(base64);
    const proceed = await confirmSoftQualityOrProceed(quality, Alert.alert);
    if (!proceed) return;
    goToAnalysis(base64);
  };

  const uploadFromGallery = async () => {
    if (uploadBusy || capturing) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      await submitCapture(base64);
    } finally {
      setUploadBusy(false);
    }
  };

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
        quality: 0.88,
        shutterSound: false,
      } as never);
      if (!photo?.base64) {
        Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
        return;
      }
      void triggerLightTap();
      await submitCapture(photo.base64);
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

              <View className="flex-1 items-center justify-center py-4" pointerEvents="box-none">
                <View pointerEvents="none">
                  <PalmScanFrame
                    hand={hand}
                    size={frameSize}
                    showInnerGuide
                    showScanLine={false}
                    cornerColor={colors.primary}
                  />
                </View>
                <View className="mt-4 w-full items-center" pointerEvents="none">
                  <LivePalmCaptureGuide capturing={capturing} partner />
                </View>
              </View>

              <View className="gap-4">
                <HandToggleRow hand={selectedHand} onSelect={setSelectedHand} compact />
                <CosmicButton
                  gradient="nebulaMd3"
                  label={capturing ? PALM_CAMERA_CAPTURING : PALM_CAMERA_MANUAL}
                  disabled={capturing}
                  onPress={() => void startScan()}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={uploadBusy || capturing}
                  onPress={() => void uploadFromGallery()}
                  className="items-center py-2 active:opacity-75">
                  <Text className="font-label text-[13px] uppercase tracking-[0.08em] text-on-surface-variant">
                    {uploadBusy ? GALLERY_OPENING : 'Upload from gallery'}
                  </Text>
                </Pressable>
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

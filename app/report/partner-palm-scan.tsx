import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { CosmicButton, GradientText } from '@/components/primitives';
import { PAGE_PADDING } from '@/constants/layout';
import { PALM_CAPTURE_FAILED } from '@/constants/userCopy';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

/** Scan a partner's palm for compatibility matching. */
export default function PartnerPalmScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [uploadBusy, setUploadBusy] = useState(false);
  const partnerPalmScanHand = useSessionStore((s) => s.partnerPalmScanHand);
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const camRef = useRef<CameraView>(null);

  const hand: PalmScanHand = partnerPalmScanHand ?? 'right';

  const continueWithCapture = (base64: string) => {
    const seed = `partner-${hand}-${Date.now()}`;
    setPartnerPalmCaptureBase64(base64);
    deferRouterPush({
      pathname: '/report/partner-palm-analysis' as never,
      params: { seed },
    });
  };

  const uploadFromGallery = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      continueWithCapture(base64);
    } finally {
      setUploadBusy(false);
    }
  };

  if (!permission) {
    return (
      <CosmicScreen insetTop={false}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter text-mist">Gathering optics…</Text>
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
              <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.4em] text-stitch-signal">
                Camera access
              </GradientText>
              <Text className="font-noto-serif text-[26px] leading-8 text-mist">We need your camera to scan their palm</Text>
              <Text className="font-inter text-[15px] leading-7 text-md-on-surface-variant">
                Ask your partner to hold their palm steady in a well-lit space. We only capture the hand—not their face.
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
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.55,
      });
      if (!photo?.base64) {
        Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
        return;
      }
      continueWithCapture(photo.base64);
    } catch {
      Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
    }
  };

  return (
    <CosmicScreen insetTop={false}>
      <CameraView ref={camRef} facing="back" style={{ flex: 1 }}>
        <View className="flex-1 bg-black/45">
          <CosmicDotGrid />
          <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
            <View className="flex-1 pb-4 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
              <View className="flex-row items-center gap-3">
                <BackButton />
                <Text className="min-w-0 flex-1 font-headline text-[20px] text-on-surface" numberOfLines={1}>
                  Scan partner&apos;s {hand} palm
                </Text>
              </View>

              <Text className="mt-4 font-inter text-[14px] leading-6 text-md-on-surface-variant">
                Center their palm inside the guide. Hold steady for a clear read.
              </Text>

              <View className="flex-1 items-center justify-center py-4">
                <PalmScanFrame hand={hand} />
              </View>

              <View className="gap-4">
                <HandToggleRow hand={partnerPalmScanHand} onSelect={setPartnerPalmScanHand} />
                <CosmicButton gradient="nebulaMd3" label="Capture palm" onPress={() => void startScan()} />
                <CosmicButton
                  variant="ghost"
                  label={uploadBusy ? 'Opening gallery…' : 'Upload from gallery'}
                  disabled={uploadBusy}
                  onPress={() => void uploadFromGallery()}
                />
                <Text className="text-center font-inter text-[12px] leading-5 text-stitch-signal/80">
                  Palm data is analyzed for matching only and stays on this device.
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </CameraView>
    </CosmicScreen>
  );
}

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { BlurContainer, CosmicButton, GradientText } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { PALM_CAPTURE_FAILED } from '@/constants/userCopy';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

async function continueWithCapture(
  base64: string,
  hand: PalmScanHand,
  setPalmCaptureBase64: (value: string) => void,
) {
  const seed = `${hand}-${Date.now()}`;
  setPalmCaptureBase64(base64);
  deferRouterPush({
    pathname: '/onboarding/analysis',
    params: { seed },
  });
}

export default function PalmScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [pastBriefing, setPastBriefing] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const camRef = useRef<CameraView>(null);

  const hand: PalmScanHand = palmScanHand ?? 'right';

  const uploadFromGallery = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      await continueWithCapture(base64, hand, setPalmCaptureBase64);
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

  const requestAndContinue = async () => {
    setPastBriefing(true);
    await requestPermission();
  };

  if (!pastBriefing) {
    return (
      <PalmScanBriefing
        hand={palmScanHand}
        onHandChange={setPalmScanHand}
        primaryLabel="Open camera"
        primaryIcon="camera"
        onPrimaryPress={() => void requestAndContinue()}
        beforePrimary={
          <CosmicButton
            variant="ghost"
            label={uploadBusy ? 'Opening gallery…' : 'Upload from gallery'}
            disabled={uploadBusy}
            onPress={() => void uploadFromGallery()}
          />
        }
      />
    );
  }

  if (!permission.granted) {
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View className="flex-1 justify-center gap-8" style={{ paddingHorizontal: PAGE_PADDING, paddingBottom: 32 }}>
            <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />
            <View className="gap-3">
              <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.4em] text-stitch-signal">
                Camera access
              </GradientText>
              <Text className="font-noto-serif text-[26px] leading-8 text-mist">We need your camera for the palm scan</Text>
              <Text className="font-inter text-[15px] leading-7 text-md-on-surface-variant">
                Use a well-lit space and hold your palm steady. We only capture your hand—not your face.
              </Text>
            </View>
            <View className="gap-3">
              <CosmicButton variant="ghost" label="Allow camera" onPress={() => requestPermission()} />
              <CosmicButton variant="ghost" label="Upload from gallery instead" onPress={() => void uploadFromGallery()} />
              <CosmicButton variant="ghost" label="Back to checklist" onPress={() => setPastBriefing(false)} />
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
      await continueWithCapture(photo.base64, hand, setPalmCaptureBase64);
    } catch {
      Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
    }
  };

  return (
    <CosmicScreen insetTop={false}>
      <CameraView ref={camRef} facing="back" style={{ flex: 1 }}>
        <View className="flex-1 bg-black/45">
          <CosmicDotGrid />
          <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
            <View className="flex-1 pb-4 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
              <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />

              <View className="mt-3 gap-2">
                <Text className="font-noto-serif text-[26px] leading-8 text-mist">Align your {hand} palm</Text>
                <Text className="font-inter text-[14px] leading-6 text-md-on-surface-variant">
                  Fit your hand inside the guide, then tap capture.
                </Text>
              </View>

              <View className="flex-1 items-center justify-center py-4">
                <PalmScanFrame hand={hand} />
              </View>

              <View className="gap-4">
                <HandToggleRow hand={palmScanHand} onSelect={setPalmScanHand} />

                <BlurContainer intensity={48} className="rounded-3xl border border-white/12 bg-cosmic-void/65 p-4">
                  <View className="gap-3">
                    <CosmicButton gradient="nebulaMd3" label="Capture palm" onPress={() => void startScan()} />
                    <CosmicButton
                      variant="ghost"
                      label={uploadBusy ? 'Opening gallery…' : 'Upload from gallery'}
                      disabled={uploadBusy}
                      onPress={() => void uploadFromGallery()}
                    />
                  </View>
                  <Text className="mt-4 text-center font-inter text-[11px] leading-5 text-md-on-primary-container/80">
                    Your palm photo is used only for your reading and stays on this device until you sign in.
                  </Text>
                </BlurContainer>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </CameraView>
    </CosmicScreen>
  );
}

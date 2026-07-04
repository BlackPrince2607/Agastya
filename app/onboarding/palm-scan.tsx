import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { CosmicButton, GradientText } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { colors } from '@/constants/theme';
import { PALM_CAPTURE_FAILED } from '@/constants/userCopy';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

async function continueWithCapture(
  base64: string,
  hand: PalmScanHand,
  setPalmScanHand: (hand: PalmScanHand) => void,
  setPalmCaptureBase64: (value: string) => void,
) {
  const seed = `${hand}-${Date.now()}`;
  setPalmScanHand(hand);
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
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>('right');
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const camRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const frameSize = Math.min(windowWidth - PAGE_PADDING * 2 - 8, Math.round(windowHeight * 0.42), 320);

  const uploadFromGallery = async (hand: PalmScanHand) => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      await continueWithCapture(base64, hand, setPalmScanHand, setPalmCaptureBase64);
    } finally {
      setUploadBusy(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="font-body text-on-surface">Loading camera...</Text>
      </View>
    );
  }

  const requestAndContinue = async (hand: PalmScanHand) => {
    setSelectedHand(hand);
    setPastBriefing(true);
    await requestPermission();
  };

  if (!pastBriefing) {
    return (
      <PalmScanBriefing
        hand={palmScanHand ?? selectedHand}
        onHandChange={setSelectedHand}
        primaryLabel="Scan palm"
        primaryIcon="camera"
        onPrimaryPress={(hand) => void requestAndContinue(hand)}
        beforePrimary={
          <CosmicButton
            variant="ghost"
            label={uploadBusy ? 'Opening gallery...' : 'Upload from gallery'}
            disabled={uploadBusy}
            onPress={() => void uploadFromGallery(selectedHand)}
          />
        }
      />
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-[#0f0e10]">
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
          <View className="flex-1 justify-center gap-8" style={{ paddingHorizontal: PAGE_PADDING }}>
            <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />
            <View className="gap-3">
              <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.4em] text-stitch-signal">
                Camera access
              </GradientText>
              <Text className="font-noto-serif text-[26px] leading-8 text-on-surface">We need your camera for the palm scan</Text>
              <Text className="font-body text-[15px] leading-7 text-on-surface-variant">
                Use a well-lit space and hold your palm steady. We only capture your hand, not your face.
              </Text>
            </View>
            <View className="gap-3">
              <CosmicButton variant="ghost" label="Allow camera" onPress={() => requestPermission()} />
              <CosmicButton
                variant="ghost"
                label="Upload from gallery instead"
                onPress={() => void uploadFromGallery(selectedHand)}
              />
              <CosmicButton variant="ghost" label="Back to checklist" onPress={() => setPastBriefing(false)} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const startScan = async () => {
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.55,
      });
      if (!photo?.base64) {
        Alert.alert("Couldn't capture palm", PALM_CAPTURE_FAILED);
        return;
      }
      await continueWithCapture(photo.base64, selectedHand, setPalmScanHand, setPalmCaptureBase64);
    } catch {
      Alert.alert("Couldn't capture palm", PALM_CAPTURE_FAILED);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={camRef} facing="back" style={{ flex: 1 }} />
      <View className="absolute inset-0 flex-col bg-black/30" pointerEvents="box-none">
        <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none">
          <View style={{ paddingHorizontal: PAGE_PADDING, paddingTop: 4 }}>
            <OnboardingHeader
              step={ONBOARDING_STEPS.palmScan}
              total={ONBOARDING_TOTAL_STEPS}
              onBack={() => setPastBriefing(false)}
            />
            <Text className="font-headline text-[22px] text-on-surface">
              {selectedHand === 'left' ? 'Left' : 'Right'} palm
            </Text>
            <Text className="mt-1 font-body text-[14px] text-on-surface-variant">
              Center your hand inside the frame
            </Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 items-center justify-center px-4" pointerEvents="none">
          <PalmScanFrame
            size={frameSize}
            hand={selectedHand}
            showInnerGuide
            showScanLine
            cornerColor={colors.primary}
          />
        </View>

        <SafeAreaView edges={['left', 'right', 'bottom']}>
          <View
            className="gap-3 border-t border-white/10 bg-black/75 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 14), paddingHorizontal: PAGE_PADDING }}>
            <HandToggleRow hand={selectedHand} onSelect={setSelectedHand} compact />

            <CosmicButton gradient="nebulaMd3" label="Capture palm" onPress={() => void startScan()} />

            <Pressable
              accessibilityRole="button"
              disabled={uploadBusy}
              onPress={() => void uploadFromGallery(selectedHand)}
              className="items-center py-2 active:opacity-75">
              <Text className="font-label text-[13px] uppercase tracking-[0.08em] text-on-surface-variant">
                {uploadBusy ? 'Opening gallery...' : 'Upload from gallery'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

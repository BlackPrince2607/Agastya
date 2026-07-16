import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmCaptureReview } from '@/components/onboarding/PalmCaptureReview';
import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import { PalmScanCoachingTips } from '@/components/onboarding/PalmScanCoachingTips';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { CosmicButton, GradientText } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { colors } from '@/constants/theme';
import {
  CAMERA_PERMISSION_LOADING,
  GALLERY_OPENING,
  PALM_CAMERA_CAPTURING,
  PALM_CAMERA_CENTER,
  PALM_CAMERA_COACHING,
  PALM_CAPTURE_FAILED,
  PALM_RETAKE_BANNER_PREFIX,
} from '@/constants/userCopy';
import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { isPalmHandLockedByGender, palmHandForGender, palmHandGuidanceLabel } from '@/utils/palmHand';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { AnalyticsEvent, track } from '@/services/analytics';
import { deferRouterPush } from '@/utils/routerDefer';

type ScanStep = 'briefing' | 'camera' | 'review';

function decodeRetakeReason(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function PalmScanScreen() {
  const { retakeReason: retakeReasonParam } = useLocalSearchParams<{ retakeReason?: string }>();
  const retakeNotice = decodeRetakeReason(retakeReasonParam);

  const userGender = useSessionStore((s) => s.userGender);
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const setPalmCaptureLandmarks = useSessionStore((s) => s.setPalmCaptureLandmarks);

  const handLocked = isPalmHandLockedByGender(userGender);
  const recommendedHand = palmHandForGender(userGender);

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<ScanStep>('briefing');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>(
    () => (handLocked ? recommendedHand : palmScanHand ?? recommendedHand),
  );
  const camRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const frameSize = Math.min(windowWidth - PAGE_PADDING * 2 - 8, Math.round(windowHeight * 0.42), 320);
  const hand = handLocked ? recommendedHand : selectedHand;

  const chooseHand = (next: PalmScanHand) => {
    if (handLocked) return;
    setSelectedHand(next);
  };

  const goToReview = (base64: string) => {
    setPreviewBase64(base64);
    setStep('review');
  };

  const uploadFromGallery = async (scanHand: PalmScanHand) => {
    if (uploadBusy || capturing) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      track(AnalyticsEvent.PALM_SCAN_STARTED, { source: 'gallery' });
      setSelectedHand(handLocked ? recommendedHand : scanHand);
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
    track(AnalyticsEvent.PALM_SCAN_COMPLETED, { landmark_source: source, hand });
    const seed = `${hand}-${Date.now()}`;
    setPalmScanHand(hand);
    setPalmCaptureBase64(previewBase64);
    setPalmCaptureLandmarks(landmarks, source);
    deferRouterPush({
      pathname: '/onboarding/analysis',
      params: { seed },
    });
  };

  if (step === 'review' && previewBase64) {
    return (
      <PalmCaptureReview
        base64={previewBase64}
        hand={hand}
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
      <CosmicScreen>
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message={CAMERA_PERMISSION_LOADING} />
        </View>
      </CosmicScreen>
    );
  }

  const requestAndContinue = async (scanHand: PalmScanHand) => {
    track(AnalyticsEvent.PALM_SCAN_STARTED, { source: 'camera' });
    setSelectedHand(handLocked ? recommendedHand : scanHand);
    setStep('camera');
    await requestPermission();
  };

  if (step === 'briefing') {
    return (
      <View className="flex-1">
        {retakeNotice ? (
          <View
            className="border-b border-amber-500/25 bg-amber-500/10 px-5 py-3"
            style={{ paddingTop: Math.max(insets.top, 8) }}>
            <Text className="font-body text-[14px] leading-5 text-amber-100/95">
              {PALM_RETAKE_BANNER_PREFIX} {retakeNotice}
            </Text>
          </View>
        ) : null}
        <PalmScanBriefing
          hand={hand}
          gender={userGender}
          onHandChange={chooseHand}
          primaryLabel="Scan palm"
          primaryIcon="camera"
          onPrimaryPress={(scanHand) => void requestAndContinue(scanHand)}
          beforePrimary={
            <CosmicButton
              variant="ghost"
              label={uploadBusy ? GALLERY_OPENING : 'Upload from gallery'}
              disabled={uploadBusy}
              onPress={() => void uploadFromGallery(hand)}
            />
          }
        />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-surface-container-lowest">
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
          <View className="flex-1 justify-center gap-8" style={{ paddingHorizontal: PAGE_PADDING }}>
            <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />
            <View className="gap-3">
              <GradientText className="font-label text-[12px] uppercase tracking-[0.4em] text-cyan">
                Camera access
              </GradientText>
              <Text className="font-headline text-[26px] leading-8 text-on-surface">
                Camera access for your palm scan
              </Text>
              <Text className="font-body text-[15px] leading-7 text-on-surface-variant">
                Find soft light and keep your palm open. We only capture your hand — never your face.
              </Text>
            </View>
            <View className="gap-3">
              <CosmicButton variant="ghost" label="Allow camera" onPress={() => requestPermission()} />
              <CosmicButton
                variant="ghost"
                label="Upload from gallery instead"
                onPress={() => void uploadFromGallery(selectedHand)}
              />
              <CosmicButton variant="ghost" label="Back to checklist" onPress={() => setStep('briefing')} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const startScan = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.72,
      });
      if (!photo?.base64) {
        Alert.alert("Couldn't capture palm", PALM_CAPTURE_FAILED);
        return;
      }
      void triggerLightTap();
      goToReview(photo.base64);
    } catch {
      Alert.alert("Couldn't capture palm", PALM_CAPTURE_FAILED);
    } finally {
      setCapturing(false);
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
              onBack={() => setStep('briefing')}
            />
            {retakeNotice ? (
              <View className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <Text className="font-body text-[13px] leading-5 text-amber-100/95">
                  {PALM_RETAKE_BANNER_PREFIX} {retakeNotice}
                </Text>
              </View>
            ) : null}
            <Text className="font-headline text-[22px] text-on-surface">
              {hand === 'left' ? 'Left' : 'Right'} palm
            </Text>
            <Text className="mt-1 font-body text-[14px] text-on-surface-variant">
              {PALM_CAMERA_CENTER}
            </Text>
            {handLocked ? (
              <Text className="mt-1.5 font-body text-[12px] leading-5 text-on-surface-variant/90">
                {palmHandGuidanceLabel(hand, userGender)}
              </Text>
            ) : null}
            <Text className="mt-1.5 font-body text-[12px] leading-5 text-on-surface-variant/80">
              {PALM_CAMERA_COACHING}
            </Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 items-center justify-center px-4" pointerEvents="none">
          <PalmScanFrame
            size={frameSize}
            hand={hand}
            showInnerGuide
            showScanLine
            cornerColor={colors.primary}
          />
        </View>

        <SafeAreaView edges={['left', 'right', 'bottom']}>
          <View
            className="gap-3 border-t border-white/10 bg-black/75 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 14), paddingHorizontal: PAGE_PADDING }}>
            <PalmScanCoachingTips compact />
            {handLocked ? null : <HandToggleRow hand={hand} onSelect={chooseHand} compact />}

            <CosmicButton
              gradient="nebulaMd3"
              label={capturing ? PALM_CAMERA_CAPTURING : 'Capture palm'}
              disabled={capturing}
              onPress={() => void startScan()}
            />

            <Pressable
              accessibilityRole="button"
              disabled={uploadBusy || capturing}
              onPress={() => void uploadFromGallery(hand)}
              className="items-center py-2 active:opacity-75">
              <Text className="font-label text-[13px] uppercase tracking-[0.08em] text-on-surface-variant">
                {uploadBusy ? GALLERY_OPENING : 'Upload from gallery'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

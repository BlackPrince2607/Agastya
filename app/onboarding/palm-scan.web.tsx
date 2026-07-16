import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PalmCaptureReview } from '@/components/onboarding/PalmCaptureReview';
import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import {
  PALM_RETAKE_BANNER_PREFIX,
} from '@/constants/userCopy';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { isPalmHandLockedByGender, palmHandForGender } from '@/utils/palmHand';
import { AnalyticsEvent, track } from '@/services/analytics';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

type ScanStep = 'briefing' | 'review';

function decodeRetakeReason(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Web: file upload instead of native camera. */
export default function PalmScanWebScreen() {
  const { retakeReason: retakeReasonParam } = useLocalSearchParams<{ retakeReason?: string }>();
  const retakeNotice = decodeRetakeReason(retakeReasonParam);
  const insets = useSafeAreaInsets();

  const userGender = useSessionStore((s) => s.userGender);
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const setPalmCaptureLandmarks = useSessionStore((s) => s.setPalmCaptureLandmarks);

  const handLocked = isPalmHandLockedByGender(userGender);
  const recommendedHand = palmHandForGender(userGender);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<ScanStep>('briefing');
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>(
    () => (handLocked ? recommendedHand : palmScanHand ?? recommendedHand),
  );

  const hand = handLocked ? recommendedHand : selectedHand;

  const chooseHand = (next: PalmScanHand) => {
    if (handLocked) return;
    setSelectedHand(next);
  };

  const uploadAndReview = async (scanHand: PalmScanHand) => {
    if (uploadBusy || confirming) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      track(AnalyticsEvent.PALM_SCAN_STARTED, { source: 'gallery' });
      setSelectedHand(handLocked ? recommendedHand : scanHand);
      setPreviewBase64(base64);
      setStep('review');
    } catch {
      Alert.alert('Upload failed', "We couldn't read that image. Try a JPG or PNG of your open palm.");
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
          setStep('briefing');
        }}
        onConfirm={confirmReview}
      />
    );
  }

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
        primaryLabel={uploadBusy ? 'Opening...' : 'Upload palm photo'}
        primaryIcon="image"
        onPrimaryPress={(scanHand) => void uploadAndReview(scanHand)}
      />
    </View>
  );
}

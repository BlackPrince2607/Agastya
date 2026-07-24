import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import { PALM_RETAKE_BANNER_PREFIX } from '@/constants/userCopy';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { isPalmHandLockedByGender, palmHandForGender } from '@/utils/palmHand';
import { AnalyticsEvent, track } from '@/services/analytics';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { assessPalmCaptureQuality, confirmSoftQualityOrProceed } from '@/utils/palmCaptureQuality';
import { deferRouterPush } from '@/utils/routerDefer';

function decodeRetakeReason(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Web: file upload instead of native camera — goes straight to analysis. */
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
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>(
    () => (handLocked ? recommendedHand : palmScanHand ?? recommendedHand),
  );

  const hand = handLocked ? recommendedHand : selectedHand;

  const chooseHand = (next: PalmScanHand) => {
    if (handLocked) return;
    setSelectedHand(next);
  };

  const uploadAndAnalyze = async (scanHand: PalmScanHand) => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      track(AnalyticsEvent.PALM_SCAN_STARTED, { source: 'gallery' });
      const nextHand = handLocked ? recommendedHand : scanHand;
      setSelectedHand(nextHand);

      const quality = assessPalmCaptureQuality(base64);
      const proceed = await confirmSoftQualityOrProceed(quality, Alert.alert);
      if (!proceed) return;

      track(AnalyticsEvent.PALM_SCAN_COMPLETED, {
        landmark_source: 'none',
        hand: nextHand,
        source: 'gallery',
      });
      const seed = `${nextHand}-${Date.now()}`;
      setPalmScanHand(nextHand);
      setPalmCaptureBase64(base64);
      setPalmCaptureLandmarks(null, null);
      useSessionStore.getState().setPalmAnalysis(null);
      deferRouterPush({
        pathname: '/onboarding/analysis',
        params: { seed },
      });
    } catch {
      Alert.alert('Upload failed', "We couldn't read that image. Try a JPG or PNG of your open palm.");
    } finally {
      setUploadBusy(false);
    }
  };

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
        onPrimaryPress={(scanHand) => void uploadAndAnalyze(scanHand)}
      />
    </View>
  );
}

import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmScanCoachingTips } from '@/components/onboarding/PalmScanCoachingTips';
import { CosmicButton, GradientText } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import {
  PARTNER_PALM_REVIEW_ANALYZE,
  PARTNER_PALM_REVIEW_TITLE,
  PALM_REVIEW_ANALYZE,
  PALM_REVIEW_ANALYZING,
  PALM_REVIEW_RETAKE,
  PALM_REVIEW_SUBTITLE,
  PALM_REVIEW_TITLE,
} from '@/constants/userCopy';
import type { PalmScanHand } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { detectHandLandmarksFromBase64 } from '@/utils/handLandmarks';
import type { HandLandmark } from '@/utils/palmLandmarks';

type PalmCaptureReviewProps = {
  base64: string;
  hand: PalmScanHand;
  variant?: 'self' | 'partner';
  showOnboardingHeader?: boolean;
  /** Unused — overlays come from backend after analysis. Kept for call-site compat. */
  palmAnalysis?: PalmAnalysisDto | null;
  onRetake: () => void;
  onConfirm: (landmarks: HandLandmark[], source: 'mediapipe' | 'roi_estimate') => void;
  confirming?: boolean;
};

function toImageUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

export function PalmCaptureReview({
  base64,
  hand,
  variant = 'self',
  showOnboardingHeader = true,
  palmAnalysis: _palmAnalysis = null,
  onRetake,
  onConfirm,
  confirming = false,
}: PalmCaptureReviewProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const previewWidth = Math.min(windowWidth - PAGE_PADDING * 2, 320);
  const previewHeight = Math.round(previewWidth * 1.28);

  const [landmarks, setLandmarks] = useState<HandLandmark[] | null>(null);
  const [landmarkSource, setLandmarkSource] = useState<'mediapipe' | 'roi_estimate' | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetecting(true);
    void detectHandLandmarksFromBase64(base64, hand).then((result) => {
      if (cancelled) return;
      setLandmarks(result.landmarks);
      setLandmarkSource(result.source);
      setDetecting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [base64, hand]);

  const title = variant === 'partner' ? PARTNER_PALM_REVIEW_TITLE : PALM_REVIEW_TITLE;
  const analyzeLabel =
    confirming || detecting ? PALM_REVIEW_ANALYZING : variant === 'partner' ? PARTNER_PALM_REVIEW_ANALYZE : PALM_REVIEW_ANALYZE;
  const handReady = Boolean(landmarks && landmarkSource === 'mediapipe');

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {showOnboardingHeader ? (
          <View style={{ paddingHorizontal: PAGE_PADDING }}>
            <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} onBack={onRetake} />
          </View>
        ) : null}

        <View className="flex-1 gap-4 px-5 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
          <View className="gap-1">
            <GradientText className="font-label text-[12px] uppercase tracking-[0.35em] text-cyan">
              {title}
            </GradientText>
            <Text className="font-body text-[14px] leading-6 text-on-surface-variant">{PALM_REVIEW_SUBTITLE}</Text>
          </View>

          <View className="items-center">
            <View
              className="relative overflow-hidden rounded-3xl border border-white/15 bg-black/40"
              style={{ width: previewWidth, height: previewHeight }}>
              <Image
                source={{ uri: toImageUri(base64) }}
                style={{ width: previewWidth, height: previewHeight }}
                resizeMode="cover"
              />
              {detecting ? (
                <View className="absolute inset-0 items-center justify-center bg-black/35">
                  <ActivityIndicator color="#d3beeb" />
                </View>
              ) : null}
              {!detecting && !handReady ? (
                <View className="absolute bottom-3 left-3 right-3 rounded-2xl border border-amber-200/30 bg-black/65 px-3 py-2">
                  <Text className="font-body text-[12px] leading-5 text-amber-100/90">
                    Hand not clearly detected — retake with your open palm filling the frame and even light.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <PalmScanCoachingTips compact />

          <View className="mt-auto gap-3" style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
            <CosmicButton
              gradient="nebulaMd3"
              label={analyzeLabel}
              disabled={detecting || confirming || !landmarks || !landmarkSource}
              onPress={() => {
                if (!landmarks || !landmarkSource) return;
                onConfirm(landmarks, landmarkSource);
              }}
            />
            <CosmicButton variant="ghost" label={PALM_REVIEW_RETAKE} disabled={confirming} onPress={onRetake} />
          </View>
        </View>
      </View>
    </View>
  );
}

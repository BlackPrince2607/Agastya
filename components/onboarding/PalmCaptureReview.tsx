import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmScanCoachingTips } from '@/components/onboarding/PalmScanCoachingTips';
import { PalmLineOverlay, palmLineLegend } from '@/components/report/PalmLineOverlay';
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
  PALM_RETAKE_DEFAULT,
} from '@/constants/userCopy';
import { analyzePalm } from '@/services/agastyaApi';
import { isPalmRetakeError } from '@/services/apiErrors';
import { isApiConfigured } from '@/services/env';
import { bootstrapIdentity } from '@/services/identity';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { hasPalmLineOverlay, isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import type { HandLandmark } from '@/utils/palmLandmarks';
import { trimBase64Payload } from '@/utils/palmLandmarks';
import { withApiRetry } from '@/utils/apiRetry';

type PalmCaptureReviewProps = {
  base64: string;
  hand: PalmScanHand;
  variant?: 'self' | 'partner';
  showOnboardingHeader?: boolean;
  /** Unused — kept for call-site compat. */
  palmAnalysis?: PalmAnalysisDto | null;
  onRetake: () => void;
  onConfirm: (
    landmarks: HandLandmark[],
    source: 'mediapipe',
    palm: PalmAnalysisDto,
  ) => void;
  confirming?: boolean;
};

function toImageUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

function reviewReady(palm: PalmAnalysisDto | null): boolean {
  if (!palm || palmNeedsRetake(palm)) return false;
  return isLivePalmAnalysis(palm) || hasPalmLineOverlay(palm);
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

  const [palm, setPalm] = useState<PalmAnalysisDto | null>(null);
  const [phase, setPhase] = useState<'reading' | 'ready' | 'failed'>('reading');
  const [statusMsg, setStatusMsg] = useState('Reading your palm…');
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    Image.getSize(
      toImageUri(base64),
      (w, h) => setImageSize({ width: w, height: h }),
      () => setImageSize(null),
    );
  }, [base64]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setPhase('reading');
      setStatusMsg('Reading your palm and major lines…');
      setPalm(null);

      if (!isApiConfigured()) {
        if (!cancelled) {
          setPhase('failed');
          setStatusMsg(PALM_RETAKE_DEFAULT);
        }
        return;
      }

      try {
        await bootstrapIdentity();
        if (cancelled) return;

        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          setPhase('failed');
          setStatusMsg(PALM_RETAKE_DEFAULT);
          return;
        }

        // Vision-first: one API call reads motifs + line overlays from the photo.
        const capture = trimBase64Payload(base64);
        const analyzed = await withApiRetry(() =>
          analyzePalm({
            sessionId: snap.sessionId!,
            deviceInstallId: snap.deviceInstallId!,
            seed: `${hand}-review-${Date.now()}`,
            imageBase64: capture,
            dominantHand: hand,
            gender: snap.userGender,
          }),
        );
        if (cancelled) return;

        if (!reviewReady(analyzed)) {
          setPhase('failed');
          setStatusMsg(PALM_RETAKE_DEFAULT);
          return;
        }

        setPalm(analyzed);
        setPhase('ready');
        setStatusMsg(
          hasPalmLineOverlay(analyzed)
            ? 'Palm lines ready — continue to your reading.'
            : 'Palm reading ready — continue.',
        );
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : PALM_RETAKE_DEFAULT;
        setPhase('failed');
        setStatusMsg(isPalmRetakeError(msg) ? msg : PALM_RETAKE_DEFAULT);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base64, hand]);

  const title = variant === 'partner' ? PARTNER_PALM_REVIEW_TITLE : PALM_REVIEW_TITLE;
  const busy = phase === 'reading' || confirming;
  const analyzeLabel = busy
    ? PALM_REVIEW_ANALYZING
    : phase === 'ready'
      ? variant === 'partner'
        ? PARTNER_PALM_REVIEW_ANALYZE
        : 'Continue with these lines'
      : variant === 'partner'
        ? PARTNER_PALM_REVIEW_ANALYZE
        : PALM_REVIEW_ANALYZE;
  const canContinue = phase === 'ready' && reviewReady(palm) && !confirming;
  const legend = palmLineLegend();
  const showOverlay = hasPalmLineOverlay(palm);

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
                resizeMode="contain"
              />
              {showOverlay && palm?.line_geometry ? (
                <PalmLineOverlay
                  geometry={palm.line_geometry}
                  width={previewWidth}
                  height={previewHeight}
                  imageWidth={imageSize?.width}
                  imageHeight={imageSize?.height}
                  resizeMode="contain"
                />
              ) : null}
              {busy ? (
                <View className="absolute inset-0 items-center justify-center bg-black/35">
                  <ActivityIndicator color="#d3beeb" />
                </View>
              ) : null}
              {!busy ? (
                <View
                  className={`absolute bottom-3 left-3 right-3 rounded-2xl border px-3.5 py-3 ${
                    phase === 'ready'
                      ? 'border-cyan/35 bg-black/65'
                      : 'border-amber-200/30 bg-black/70'
                  }`}>
                  <Text
                    className={`font-body text-[12px] leading-[18px] ${
                      phase === 'ready' ? 'text-cyan/95' : 'text-amber-100/95'
                    }`}>
                    {statusMsg}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {phase === 'ready' && showOverlay ? (
            <View className="flex-row flex-wrap justify-center gap-3">
              {legend.map((item) => (
                <View key={item.key} className="flex-row items-center gap-1.5">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <Text className="font-label text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <PalmScanCoachingTips compact />
          )}

          <View className="mt-auto gap-3" style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
            <CosmicButton
              gradient="nebulaMd3"
              label={analyzeLabel}
              disabled={!canContinue}
              onPress={() => {
                if (!palm || !reviewReady(palm)) return;
                // Landmarks optional — vision path owns the reading.
                onConfirm([], 'mediapipe', palm);
              }}
            />
            <CosmicButton variant="ghost" label={PALM_REVIEW_RETAKE} disabled={confirming} onPress={onRetake} />
          </View>
        </View>
      </View>
    </View>
  );
}

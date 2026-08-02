import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { AnalyzingSeal, CosmicButton, GradientText } from '@/components/primitives';
import {
  ANALYSIS_STAGE_ANALYZING,
  ANALYSIS_STAGE_FEATURES,
  ANALYSIS_STAGE_PREPARING,
  ANALYSIS_STAGE_UPLOADING,
  PALM_RETRY_CTA,
  PALM_RETRY_REASONS_DEFAULT,
  PALM_RETRY_SUBTITLE,
  PALM_RETRY_TITLE,
  SAMPLE_READING_BADGE,
} from '@/constants/userCopy';
import { PAGE_PADDING } from '@/constants/layout';
import { ANALYSIS_SETTLE_MS } from '@/constants/onboarding';
import { ApiHttpError, parsePalmUnreadable } from '@/services/apiErrors';
import { analyzePalm } from '@/services/agastyaApi';
import { bootstrapIdentity } from '@/services/identity';
import { isApiConfigured } from '@/services/env';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterReplace } from '@/utils/routerDefer';
import { delay } from '@/utils/analysisTiming';
import { withApiRetry } from '@/utils/apiRetry';
import { trimBase64Payload } from '@/utils/palmLandmarks';

const FALLBACK_PALM: PalmAnalysisDto = {
  life_line: 'strong',
  heart_line: 'curved',
  head_line: 'long',
  personality: 'warm',
  traits: ['empathetic', 'loyal'],
  analysis_source: 'fallback',
};

type FlowPhase = 'working' | 'retry';
type WorkStage = 0 | 1 | 2 | 3;

const STAGE_LABELS = [
  ANALYSIS_STAGE_UPLOADING,
  ANALYSIS_STAGE_ANALYZING,
  ANALYSIS_STAGE_FEATURES,
  ANALYSIS_STAGE_PREPARING,
] as const;

function stagePct(stage: WorkStage): number {
  return [10, 35, 65, 92][stage] ?? 10;
}

/** Analyze partner palm capture and return to compatibility — no overlay confirm. */
export default function PartnerPalmAnalysisScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const setPartnerPalmAnalysis = useSessionStore((s) => s.setPartnerPalmAnalysis);

  const [flowPhase, setFlowPhase] = useState<FlowPhase>('working');
  const [stage, setStage] = useState<WorkStage>(0);
  const [pct, setPct] = useState(10);
  const [sampleBadge, setSampleBadge] = useState(false);
  const [retryMessage, setRetryMessage] = useState(PALM_RETRY_TITLE);
  const [retryReasons, setRetryReasons] = useState<string[]>([...PALM_RETRY_REASONS_DEFAULT]);
  const runIdRef = useRef(0);

  const showRetry = useCallback((message: string, reasons?: string[]) => {
    setRetryMessage(message || PALM_RETRY_TITLE);
    setRetryReasons(reasons?.length ? reasons : [...PALM_RETRY_REASONS_DEFAULT]);
    setFlowPhase('retry');
    useSessionStore.setState({
      partnerPalmCaptureBase64: null,
      partnerPalmCaptureLandmarks: null,
      partnerPalmLandmarksSource: null,
    });
  }, []);

  const goRetake = useCallback(() => {
    deferRouterReplace('/report/partner-palm-scan' as never);
  }, []);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const resolvedSeed = seed ?? `partner-${Date.now()}`;
    setFlowPhase('working');
    setStage(0);
    setPct(10);
    setSampleBadge(false);

    let cancelled = false;
    const advance = (next: WorkStage) => {
      if (cancelled || runId !== runIdRef.current) return;
      setStage(next);
      setPct(stagePct(next));
    };

    void (async () => {
      try {
        advance(0);
        await bootstrapIdentity();
        if (cancelled || runId !== runIdRef.current) return;

        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          showRetry('Something went wrong starting your session. Please try again.');
          return;
        }

        const capture = snap.partnerPalmCaptureBase64
          ? trimBase64Payload(snap.partnerPalmCaptureBase64)
          : null;
        if (isApiConfigured() && !capture) {
          showRetry('The palm photo was lost before upload. Please scan again.', [
            'photo missing after capture',
          ]);
          return;
        }

        advance(1);
        let palm: PalmAnalysisDto = FALLBACK_PALM;

        if (isApiConfigured()) {
          try {
            palm = await withApiRetry(() =>
              analyzePalm({
                sessionId: snap.sessionId!,
                deviceInstallId: snap.deviceInstallId!,
                seed: resolvedSeed,
                imageBase64: capture,
                dominantHand: snap.partnerPalmScanHand ?? 'right',
              }),
            );
          } catch (err) {
            if (cancelled || runId !== runIdRef.current) return;
            const parsed = parsePalmUnreadable(err);
            if (parsed) {
              showRetry(parsed.message, parsed.reasons);
              return;
            }
            const msg =
              err instanceof ApiHttpError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : 'Palm analysis failed';
            showRetry(msg);
            return;
          }

          if (palmNeedsRetake(palm)) {
            showRetry(PALM_RETRY_TITLE, [...PALM_RETRY_REASONS_DEFAULT]);
            return;
          }
          if (!isLivePalmAnalysis(palm)) {
            setSampleBadge(true);
          }
        } else {
          palm = FALLBACK_PALM;
          setSampleBadge(true);
        }

        if (cancelled || runId !== runIdRef.current) return;
        setPartnerPalmAnalysis(palm);
        useSessionStore.setState({
          partnerPalmCaptureBase64: null,
          partnerPalmCaptureLandmarks: null,
          partnerPalmLandmarksSource: null,
        });

        advance(2);
        await delay(350);
        if (cancelled || runId !== runIdRef.current) return;
        advance(3);
        setPct(100);
        await delay(ANALYSIS_SETTLE_MS);
        if (cancelled || runId !== runIdRef.current) return;
        deferRouterReplace('/report/compatibility' as never);
      } catch {
        if (cancelled || runId !== runIdRef.current) return;
        if (isApiConfigured()) {
          showRetry(PALM_RETRY_TITLE, [...PALM_RETRY_REASONS_DEFAULT]);
          return;
        }
        setPartnerPalmAnalysis(FALLBACK_PALM);
        deferRouterReplace('/report/compatibility' as never);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seed, setPartnerPalmAnalysis, showRetry]);

  if (flowPhase === 'retry') {
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View
            className="flex-1 justify-between pb-10 pt-12"
            style={{ paddingHorizontal: PAGE_PADDING }}>
            <View className="gap-4">
              <GradientText className="font-label text-[12px] uppercase tracking-[0.12em] text-cyan">
                Try again
              </GradientText>
              <Text className="font-headline text-[24px] leading-8 text-on-surface">{retryMessage}</Text>
              <Text className="font-body text-[14px] leading-6 text-on-surface-variant">
                {PALM_RETRY_SUBTITLE}
              </Text>
              <View className="gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                {retryReasons.map((reason) => (
                  <Text key={reason} className="font-body text-[14px] leading-6 text-amber-100/95">
                    • {reason}
                  </Text>
                ))}
              </View>
            </View>
            <CosmicButton gradient="nebulaMd3" label={PALM_RETRY_CTA} onPress={goRetake} />
          </View>
        </View>
      </CosmicScreen>
    );
  }

  const caption = STAGE_LABELS[stage] ?? ANALYSIS_STAGE_UPLOADING;

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View className="flex-1 justify-between px-7 pb-16 pt-12">
          <View className="items-center gap-5">
            <GradientText className="font-label text-[12px] uppercase tracking-[0.12em] text-cyan">
              Reading partner palm
            </GradientText>
            {sampleBadge ? (
              <Text className="max-w-[320px] text-center font-body text-[12px] leading-5 text-amber-200/90">
                {SAMPLE_READING_BADGE}
              </Text>
            ) : null}
            <View className="relative items-center justify-center">
              <AnalyzingSeal diameter={220} hideCenterGlyph progress={pct} />
              <View className="pointer-events-none absolute items-center justify-center gap-1">
                <Text className="font-headline text-[28px] text-on-surface/95">{pct}%</Text>
              </View>
            </View>
          </View>

          <View className="gap-8">
            <MotiView key={stage} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Text className="text-center font-body text-[17px] font-medium leading-7 text-on-surface">
                {caption}
              </Text>
            </MotiView>
            <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <View
                className="h-full rounded-full bg-cyan"
                style={{ width: `${Math.min(100, Math.round(pct))}%` }}
              />
            </View>
          </View>
        </View>
      </View>
    </CosmicScreen>
  );
}

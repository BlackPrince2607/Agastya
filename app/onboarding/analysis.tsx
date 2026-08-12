import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { AnalyzingSeal, CosmicButton, GradientText } from '@/components/primitives';
import {
  ANALYSIS_STAGE_ANALYZING,
  ANALYSIS_STAGE_BLUEPRINT,
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
import { ApiHttpError, parsePalmUnreadable } from '@/services/apiErrors';
import { analyzePalm, generateReport } from '@/services/agastyaApi';
import { bootstrapIdentity, syncProfileRemote } from '@/services/identity';
import { normalizeFullReport } from '@/services/normalizeReport';
import { scheduleReadyNotification, getExpoPushToken } from '@/services/notifications';
import { AnalyticsEvent, track } from '@/services/analytics';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { isApiConfigured } from '@/services/env';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import { useSessionStore } from '@/store/sessionStore';
import { ANALYSIS_SETTLE_MS, ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { deferRouterReplace } from '@/utils/routerDefer';
import {
  ANALYSIS_ANALYZE_CREEP_MS,
  ANALYSIS_FLOW_WATCHDOG_MS,
  PALM_ANALYZE_CLIENT_TIMEOUT_MS,
  delay,
  raceWithTimeout,
} from '@/utils/analysisTiming';
import { withApiRetry } from '@/utils/apiRetry';
import { palmHandForGender } from '@/utils/palmHand';
import { trimBase64Payload } from '@/utils/palmLandmarks';

const FALLBACK_PALM: PalmAnalysisDto = {
  life_line: 'strong',
  heart_line: 'curved',
  head_line: 'long',
  personality: 'visionary',
  traits: ['independent', 'overthinker'],
  analysis_source: 'fallback',
};

type FlowPhase = 'working' | 'retry';
type WorkStage = 0 | 1 | 2 | 3 | 4;

const STAGE_LABELS = [
  ANALYSIS_STAGE_UPLOADING,
  ANALYSIS_STAGE_ANALYZING,
  ANALYSIS_STAGE_FEATURES,
  ANALYSIS_STAGE_BLUEPRINT,
  ANALYSIS_STAGE_PREPARING,
] as const;

function stagePct(stage: WorkStage): number {
  return [8, 28, 52, 78, 96][stage] ?? 8;
}

export default function AnalysisScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const setReadingSeed = useSessionStore((s) => s.setReadingSeed);
  const setPalmAnalysis = useSessionStore((s) => s.setPalmAnalysis);
  const setPreviewReading = useSessionStore((s) => s.setPreviewReading);

  const [flowPhase, setFlowPhase] = useState<FlowPhase>('working');
  const [stage, setStage] = useState<WorkStage>(0);
  const animatedPct = useSharedValue(8);
  const [displayPct, setDisplayPct] = useState(8);
  const [sampleBadge, setSampleBadge] = useState(false);
  const [retryMessage, setRetryMessage] = useState(PALM_RETRY_TITLE);
  const [retryReasons, setRetryReasons] = useState<string[]>([...PALM_RETRY_REASONS_DEFAULT]);
  const runIdRef = useRef(0);

  useAnimatedReaction(
    () => animatedPct.value,
    (value) => {
      runOnJS(setDisplayPct)(Math.round(value));
    },
  );

  const showRetry = useCallback((message: string, reasons?: string[]) => {
    setRetryMessage(message || PALM_RETRY_TITLE);
    setRetryReasons(reasons?.length ? reasons : [...PALM_RETRY_REASONS_DEFAULT]);
    setFlowPhase('retry');
    useSessionStore.getState().setPalmCaptureBase64(null);
    useSessionStore.getState().setPalmCaptureLandmarks(null, null);
  }, []);

  const goRetake = useCallback(() => {
    deferRouterReplace({
      pathname: '/onboarding/palm-scan',
      params: { retakeReason: encodeURIComponent(retryMessage) },
    });
  }, [retryMessage]);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const resolvedSeed = seed ?? `trace-${Date.now()}`;
    setReadingSeed(resolvedSeed);
    setFlowPhase('working');
    setStage(0);
    animatedPct.value = 8;
    setDisplayPct(8);
    setSampleBadge(false);

    let cancelled = false;
    const runAbort = new AbortController();

    const tripWatchdog = () => {
      if (cancelled || runId !== runIdRef.current) return;
      cancelled = true;
      runIdRef.current += 1;
      runAbort.abort();
      showRetry('This is taking longer than expected. Please try again.', [
        'request timed out',
        'check your connection',
      ]);
    };

    // Hard ceiling so a hung native fetch cannot leave this screen spinning forever.
    const watchdog = setTimeout(tripWatchdog, ANALYSIS_FLOW_WATCHDOG_MS);

    const advance = (next: WorkStage) => {
      if (cancelled || runId !== runIdRef.current) return;
      setStage(next);
      const target = stagePct(next);
      // Soft creep during analyze (28%→48%) so a long OpenRouter call does not look frozen.
      if (next === 1) {
        animatedPct.value = target;
        animatedPct.value = withTiming(48, { duration: ANALYSIS_ANALYZE_CREEP_MS });
        return;
      }
      if (next === 3) {
        animatedPct.value = target;
        animatedPct.value = withTiming(90, { duration: 55_000 });
        return;
      }
      animatedPct.value = withTiming(target, { duration: 900 });
    };

    void (async () => {
      try {
        advance(0);
        await bootstrapIdentity();
        await syncProfileRemote();
        if (cancelled || runId !== runIdRef.current) return;

        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          showRetry('Something went wrong starting your session. Please try again.');
          return;
        }

        const capture = snap.palmCaptureBase64 ? trimBase64Payload(snap.palmCaptureBase64) : null;
        if (isApiConfigured() && !capture) {
          showRetry('The palm photo was lost before upload. Please scan again.', [
            'photo missing after capture',
          ]);
          return;
        }

        const handSnapshot = snap.palmScanHand ?? palmHandForGender(snap.userGender);

        advance(1);
        let palm: PalmAnalysisDto = FALLBACK_PALM;

        if (isApiConfigured()) {
          try {
            // Promise.race covers RN cases where fetch abort never rejects.
            palm = await raceWithTimeout(
              withApiRetry(() =>
                analyzePalm(
                  {
                    sessionId: snap.sessionId!,
                    deviceInstallId: snap.deviceInstallId!,
                    seed: resolvedSeed,
                    imageBase64: capture,
                    dominantHand: handSnapshot,
                    gender: snap.userGender,
                  },
                  { signal: runAbort.signal, timeoutMs: PALM_ANALYZE_CLIENT_TIMEOUT_MS },
                ),
              ),
              PALM_ANALYZE_CLIENT_TIMEOUT_MS + 8_000,
              '/v1/palm/analyze',
              runAbort.signal,
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
        setPalmAnalysis(palm);
        advance(2);
        await delay(400);
        if (cancelled || runId !== runIdRef.current) return;

        advance(3);
        const snap2 = useSessionStore.getState();
        let expoPushToken: string | null = null;
        try {
          if (isApiConfigured()) {
            expoPushToken = await getExpoPushToken();
            const runGenerate = () =>
              withApiRetry(() =>
                generateReport(
                  {
                    sessionId: snap2.sessionId!,
                    seed: resolvedSeed,
                    palmAnalysis: palm,
                    focusTopics: snap2.focusTopics,
                    mode: 'preview',
                    displayName: snap2.userDisplayName,
                    gender: snap2.userGender,
                    expoPushToken,
                  },
                  { signal: runAbort.signal },
                ),
              );
            const previewPayload = await raceWithTimeout(
              runGenerate(),
              78_000,
              '/v1/reports/generate',
              runAbort.signal,
            );
            setPreviewReading(normalizeFullReport(previewPayload));
          } else {
            setPreviewReading(buildSimulatedReading(resolvedSeed, snap2.focusTopics, palm));
          }
        } catch (err) {
          if (cancelled || runId !== runIdRef.current) return;
          if (isApiConfigured()) {
            showRetry(
              "Your palm was read, but we couldn't build the Life Blueprint. Please try again.",
              ['report generation failed', 'check your connection'],
            );
            return;
          }
          setPreviewReading(buildSimulatedReading(resolvedSeed, snap2.focusTopics, palm));
        }

        if (cancelled || runId !== runIdRef.current) return;
        advance(4);
        animatedPct.value = withTiming(100, { duration: 600 });
        track(AnalyticsEvent.REPORT_GENERATED, { mode: 'preview' });
        track(AnalyticsEvent.ANALYSIS_COMPLETED);
        useSessionStore.getState().setSkipCloudRestore(false);
        // Remote push handles ready notify when Expo token is available.
        if (!expoPushToken) {
          void scheduleReadyNotification();
        }
        useSessionStore.getState().setPalmCaptureLandmarks(null, null);
        await delay(ANALYSIS_SETTLE_MS);
        if (cancelled || runId !== runIdRef.current) return;
        deferRouterReplace({
          pathname: '/onboarding/report-preview',
          params: { seed: resolvedSeed },
        });
      } catch {
        if (cancelled || runId !== runIdRef.current) return;
        if (isApiConfigured()) {
          showRetry(PALM_RETRY_TITLE, [...PALM_RETRY_REASONS_DEFAULT]);
          return;
        }
        const resolvedSeedOffline = seed ?? `trace-${Date.now()}`;
        setPalmAnalysis(FALLBACK_PALM);
        setPreviewReading(
          buildSimulatedReading(resolvedSeedOffline, useSessionStore.getState().focusTopics, FALLBACK_PALM),
        );
        deferRouterReplace({
          pathname: '/onboarding/report-preview',
          params: { seed: resolvedSeedOffline },
        });
      } finally {
        clearTimeout(watchdog);
      }
    })();

    return () => {
      cancelled = true;
      runAbort.abort();
      clearTimeout(watchdog);
    };
  }, [seed, setPalmAnalysis, setPreviewReading, setReadingSeed, showRetry]);

  if (flowPhase === 'retry') {
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View
            className="flex-1 justify-between pb-10 pt-2"
            style={{ paddingHorizontal: PAGE_PADDING }}>
            <OnboardingHeader step={ONBOARDING_STEPS.analysis} total={ONBOARDING_TOTAL_STEPS} showBack={false} />
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
              <Text className="font-body text-[14px] leading-6 text-on-surface-variant">
                Please retake the photo with your open palm filling the frame and even light.
              </Text>
            </View>
            <CosmicButton gradient="nebulaMd3" label={PALM_RETRY_CTA} onPress={goRetake} />
          </View>
        </View>
      </CosmicScreen>
    );
  }

  const caption = STAGE_LABELS[stage] ?? ANALYSIS_STAGE_UPLOADING;
  const progressLabel = `${caption}, ${displayPct} percent complete`;

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View
          className="flex-1 justify-between pb-16 pt-2"
          style={{ paddingHorizontal: PAGE_PADDING }}>
          <OnboardingHeader step={ONBOARDING_STEPS.analysis} total={ONBOARDING_TOTAL_STEPS} showBack={false} />

          <View className="items-center gap-5">
            <GradientText className="font-label text-[12px] uppercase tracking-[0.12em] text-cyan">
              Building your reading
            </GradientText>
            {sampleBadge ? (
              <Text className="max-w-[320px] text-center font-body text-[12px] leading-5 text-amber-200/90">
                {SAMPLE_READING_BADGE}
              </Text>
            ) : null}
            <View className="relative items-center justify-center">
              <AnalyzingSeal
                diameter={244}
                hideCenterGlyph
                progress={displayPct}
                accessibilityLabel={progressLabel}
              />
              <View className="pointer-events-none absolute items-center justify-center gap-1">
                <Text className="font-label text-[28px] font-semibold text-on-surface/95">{displayPct}%</Text>
              </View>
            </View>
          </View>

          <View className="gap-8">
            <MotiView key={stage} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Text className="text-center font-body text-[17px] font-medium leading-7 text-on-surface">
                {caption}
              </Text>
            </MotiView>

            <View className="gap-2.5">
              {STAGE_LABELS.map((label, idx) => {
                const done = idx < stage;
                const active = idx === stage;
                return (
                  <View key={label} className="flex-row items-center gap-3">
                    <View
                      className={`h-2 w-2 rounded-full ${
                        done || active ? 'bg-cyan' : 'bg-white/20'
                      }`}
                    />
                    <Text
                      className={`font-body text-[14px] leading-5 ${
                        done || active ? 'text-on-surface' : 'text-on-surface-variant/70'
                      }`}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: displayPct }}
              accessibilityLabel={progressLabel}>
              <View
                className="h-full rounded-full bg-cyan"
                style={{ width: `${Math.min(100, displayPct)}%` }}
              />
            </View>
          </View>
        </View>
      </View>
    </CosmicScreen>
  );
}

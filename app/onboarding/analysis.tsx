import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { ReadingChecklist, type ChecklistItem } from '@/components/onboarding/ReadingChecklist';
import { AnalyzingSeal, GradientText } from '@/components/primitives';
import {
  ANALYSIS_LOADING_PHRASES,
  ANALYSIS_SEAL_STATUS,
  ANALYSIS_STATUS_ALMOST,
  ANALYSIS_STATUS_READY,
  PALM_RETAKE_DEFAULT,
  SAMPLE_READING_BADGE,
} from '@/constants/userCopy';
import { isPalmRetakeError } from '@/services/apiErrors';
import { analyzePalm, generateReport } from '@/services/agastyaApi';
import { bootstrapIdentity, syncProfileRemote } from '@/services/identity';
import { normalizeFullReport } from '@/services/normalizeReport';
import { scheduleReadyNotification } from '@/services/notifications';
import { AnalyticsEvent, track } from '@/services/analytics';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { isApiConfigured } from '@/services/env';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import { useSessionStore } from '@/store/sessionStore';
import {
  ANALYSIS_PHRASE_MS,
  ANALYSIS_SETTLE_MS,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from '@/constants/onboarding';
import { deferRouterReplace } from '@/utils/routerDefer';
import {
  analysisPresentationMs,
  analysisProgressPct,
  delay,
  palmFieldsVisibleAt,
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

export default function AnalysisScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const setReadingSeed = useSessionStore((s) => s.setReadingSeed);
  const setPalmAnalysis = useSessionStore((s) => s.setPalmAnalysis);
  const setPreviewReading = useSessionStore((s) => s.setPreviewReading);

  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [syncPulse, setSyncPulse] = useState(0);
  const [sampleBadge, setSampleBadge] = useState(false);
  const [palmResult, setPalmResult] = useState<PalmAnalysisDto | null>(null);
  const [apiPalm, setApiPalm] = useState<PalmAnalysisDto | null>(null);

  const runMs = analysisPresentationMs(ANALYSIS_LOADING_PHRASES.length);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - started;
      const next = analysisProgressPct(elapsed, runMs);
      setPct(next);
      setSyncPulse(next / 100);
      setPalmResult(palmFieldsVisibleAt(elapsed, apiPalm));
    }, 80);
    return () => clearInterval(tick);
  }, [runMs, apiPalm]);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % ANALYSIS_LOADING_PHRASES.length), ANALYSIS_PHRASE_MS);
    return () => clearInterval(id);
  }, []);

  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const resolvedSeed = seed ?? `trace-${Date.now()}`;

    setReadingSeed(resolvedSeed);

    // Snapshot before any await — cloud restore / merge after sign-in can race with a second pipeline.
    const snap0 = useSessionStore.getState();
    const captureSnapshot = snap0.palmCaptureBase64;
    const landmarksSnapshot = snap0.palmCaptureLandmarks;
    const landmarksSourceSnapshot = snap0.palmLandmarksSource;
    const genderSnapshot = snap0.userGender;
    const handSnapshot = snap0.palmScanHand ?? palmHandForGender(genderSnapshot);

    const minDelay = delay(runMs);

    let cancelled = false;

    void (async () => {
      let needsRetake = false;
      let retakeReason = PALM_RETAKE_DEFAULT;
      let resolvedPalm: PalmAnalysisDto = FALLBACK_PALM;

      const pipeline = async () => {
        await bootstrapIdentity();
        await syncProfileRemote();
        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          throw new Error('missing_session');
        }

        const capture = captureSnapshot ? trimBase64Payload(captureSnapshot) : null;
        if (isApiConfigured() && !capture) {
          needsRetake = true;
          retakeReason = 'The palm photo was lost before upload. Please scan again.';
          return;
        }
        let palm: PalmAnalysisDto = FALLBACK_PALM;
        try {
          palm = await withApiRetry(() =>
            analyzePalm({
              sessionId: snap.sessionId!,
              deviceInstallId: snap.deviceInstallId!,
              seed: resolvedSeed,
              imageBase64: capture,
              dominantHand: handSnapshot,
              gender: genderSnapshot,
              landmarks: landmarksSnapshot ?? undefined,
              landmarksSource: landmarksSourceSnapshot ?? undefined,
            }),
          );
          resolvedPalm = palm;
          setApiPalm(palm);
          if (palmNeedsRetake(palm)) {
            needsRetake = true;
            retakeReason = PALM_RETAKE_DEFAULT;
            return;
          }
          if (!isLivePalmAnalysis(palm)) {
            setSampleBadge(true);
          }
        } catch (err) {
          const online = isApiConfigured();
          if (online) {
            const msg = err instanceof Error ? err.message : 'Analysis failed';
            if (isPalmRetakeError(msg)) {
              needsRetake = true;
              retakeReason = msg;
              return;
            }
            throw err;
          }
          palm = FALLBACK_PALM;
          setSampleBadge(true);
        }

        resolvedPalm = palm;
        setApiPalm(palm);
        setPalmAnalysis(palm);

        try {
          const previewPayload = await withApiRetry(() =>
            generateReport({
              sessionId: snap.sessionId!,
              seed: resolvedSeed,
              palmAnalysis: palm,
              focusTopics: snap.focusTopics,
              mode: 'preview',
              displayName: snap.userDisplayName,
              gender: snap.userGender,
            }),
          );
          setPreviewReading(normalizeFullReport(previewPayload));
        } catch {
          setPreviewReading(buildSimulatedReading(resolvedSeed, snap.focusTopics, palm));
        }

        track(AnalyticsEvent.REPORT_GENERATED, { mode: 'preview' });
        useSessionStore.getState().setSkipCloudRestore(false);
        void scheduleReadyNotification();
      };

      try {
        await Promise.all([minDelay, pipeline()]);
      } catch {
        if (cancelled || runId !== runIdRef.current) return;
        const snap = useSessionStore.getState();
        setSampleBadge(true);
        resolvedPalm = FALLBACK_PALM;
        setApiPalm(FALLBACK_PALM);
        setPalmAnalysis(FALLBACK_PALM);
        setPreviewReading(buildSimulatedReading(resolvedSeed, snap.focusTopics, FALLBACK_PALM));
        track(AnalyticsEvent.REPORT_GENERATED, { mode: 'preview', fallback: true });
        useSessionStore.getState().setSkipCloudRestore(false);
      } finally {
        if (cancelled || runId !== runIdRef.current) return;
        setPalmResult(resolvedPalm);
        setPct(100);
        setSyncPulse(1);
        await delay(ANALYSIS_SETTLE_MS);
        if (cancelled || runId !== runIdRef.current) return;
        if (needsRetake) {
          useSessionStore.getState().setPalmCaptureBase64(null);
          useSessionStore.getState().setPalmCaptureLandmarks(null, null);
          Alert.alert('Try again', retakeReason, [
            {
              text: 'OK',
              onPress: () =>
                deferRouterReplace({
                  pathname: '/onboarding/palm-scan',
                  params: { retakeReason: encodeURIComponent(retakeReason) },
                }),
            },
          ]);
          return;
        }
        // Keep palmCaptureBase64 so report-preview can overlay scanned lines on the photo.
        useSessionStore.getState().setPalmCaptureLandmarks(null, null);
        deferRouterReplace({
          pathname: '/onboarding/report-preview',
          params: { seed: resolvedSeed },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seed, setPalmAnalysis, setPreviewReading, setReadingSeed, runMs]);

  const caption = ANALYSIS_LOADING_PHRASES[phase] ?? ANALYSIS_LOADING_PHRASES[0];

  const checklist: ChecklistItem[] = useMemo(() => {
    const p = palmResult;
    const lineDone = Boolean(p?.life_line && p?.heart_line && p?.head_line);
    const mountsDone = Boolean(p?.mounts && Object.keys(p.mounts).length > 0);
    const shapeDone = Boolean(p?.hand_shape);
    const fingersDone = Boolean(p?.line_details || p?.fate_line);
    return [
      { label: 'Major lines', state: lineDone ? 'done' : pct > 30 ? 'active' : 'pending' },
      { label: 'Mounts', state: mountsDone ? 'done' : pct > 55 ? 'active' : 'pending' },
      { label: 'Hand shape', state: shapeDone ? 'done' : pct > 78 ? 'active' : 'pending' },
      { label: 'Fine details', state: fingersDone ? 'done' : pct >= 100 ? 'active' : 'pending' },
    ];
  }, [palmResult, pct]);

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View className="flex-1 justify-between px-7 pb-16 pt-2">
          <OnboardingHeader step={ONBOARDING_STEPS.analysis} total={ONBOARDING_TOTAL_STEPS} showBack={false} />

          <View className="items-center gap-5">
            <GradientText className="font-label text-[12px] uppercase tracking-[0.12em] text-cyan">
              Analyzing your palm
            </GradientText>
            {sampleBadge ? (
              <Text className="max-w-[320px] text-center font-body text-[12px] leading-5 text-amber-200/90">
                {SAMPLE_READING_BADGE}
              </Text>
            ) : null}
            <View className="relative items-center justify-center">
              <AnalyzingSeal diameter={244} hideCenterGlyph />
              <View className="pointer-events-none absolute items-center justify-center gap-1">
                <Text className="font-label text-[28px] font-semibold text-on-surface/95">{pct}%</Text>
                <Text className="font-label text-[10px] uppercase tracking-[0.35em] text-on-surface-variant">
                  {ANALYSIS_SEAL_STATUS}
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-10">
            <MotiView key={phase} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Text className="text-center font-body text-[17px] font-medium leading-7 text-on-surface">{caption}</Text>
            </MotiView>

            <View className="self-center rounded-glass border border-white/10 bg-white/[0.04] px-6 py-5">
              <Text className="mb-4 font-label text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                Reading your
              </Text>
              <ReadingChecklist items={checklist} />
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="font-label text-[9px] uppercase tracking-[0.28em] text-on-primary-container">
                  Reading progress
                </Text>
                <Text className="font-body text-[11px] text-cyan/85">{pct}%</Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <View
                  className="h-full rounded-full bg-cyan shadow-glow-teal"
                  style={{ width: `${Math.round(syncPulse * 100)}%` }}
                />
              </View>
            </View>

            <Text className="text-center font-body text-[13px] text-on-surface-variant">
              {pct >= 100 ? ANALYSIS_STATUS_READY : ANALYSIS_STATUS_ALMOST}
            </Text>
          </View>
        </View>
      </View>
    </CosmicScreen>
  );
}

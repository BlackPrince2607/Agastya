import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Text, useWindowDimensions, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { ReadingChecklist, type ChecklistItem } from '@/components/onboarding/ReadingChecklist';
import { PalmLineOverlay, palmLineLegend } from '@/components/report/PalmLineOverlay';
import { AnalyzingSeal, CosmicButton, GradientText } from '@/components/primitives';
import {
  ANALYSIS_LOADING_PHRASES,
  ANALYSIS_SEAL_STATUS,
  ANALYSIS_STATUS_ALMOST,
  ANALYSIS_STATUS_READY,
  PALM_LINES_BUILDING,
  PALM_LINES_CONFIRM_CTA,
  PALM_LINES_CONFIRM_RETAKE,
  PALM_LINES_CONFIRM_SUBTITLE,
  PALM_LINES_CONFIRM_TITLE,
  PALM_RETAKE_DEFAULT,
  SAMPLE_READING_BADGE,
} from '@/constants/userCopy';
import { PAGE_PADDING } from '@/constants/layout';
import { isPalmRetakeError } from '@/services/apiErrors';
import { analyzePalm, generateReport } from '@/services/agastyaApi';
import { bootstrapIdentity, syncProfileRemote } from '@/services/identity';
import { normalizeFullReport } from '@/services/normalizeReport';
import { scheduleReadyNotification } from '@/services/notifications';
import { AnalyticsEvent, track } from '@/services/analytics';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { isApiConfigured } from '@/services/env';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { hasPalmLineOverlay, isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
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

type FlowPhase = 'analyzing' | 'confirm' | 'reporting';

function toImageUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

export default function AnalysisScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const setReadingSeed = useSessionStore((s) => s.setReadingSeed);
  const setPalmAnalysis = useSessionStore((s) => s.setPalmAnalysis);
  const setPreviewReading = useSessionStore((s) => s.setPreviewReading);
  const palmCaptureBase64 = useSessionStore((s) => s.palmCaptureBase64);
  const { width: windowWidth } = useWindowDimensions();

  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [syncPulse, setSyncPulse] = useState(0);
  const [sampleBadge, setSampleBadge] = useState(false);
  const [palmResult, setPalmResult] = useState<PalmAnalysisDto | null>(null);
  const [apiPalm, setApiPalm] = useState<PalmAnalysisDto | null>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('analyzing');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const apiPalmRef = useRef<PalmAnalysisDto | null>(null);
  const resolvedSeedRef = useRef(`trace-${Date.now()}`);

  const runMs = analysisPresentationMs(ANALYSIS_LOADING_PHRASES.length);
  const overlayWidth = Math.min(windowWidth - PAGE_PADDING * 2, 320);
  const overlayHeight = Math.round(overlayWidth * 1.28);

  useEffect(() => {
    apiPalmRef.current = apiPalm;
  }, [apiPalm]);

  useEffect(() => {
    if (!palmCaptureBase64) {
      setImageSize(null);
      return;
    }
    Image.getSize(
      toImageUri(palmCaptureBase64),
      (w, h) => setImageSize({ width: w, height: h }),
      () => setImageSize(null),
    );
  }, [palmCaptureBase64]);

  useEffect(() => {
    if (flowPhase !== 'analyzing') return;
    const id = setInterval(() => setPhase((p) => (p + 1) % ANALYSIS_LOADING_PHRASES.length), ANALYSIS_PHRASE_MS);
    return () => clearInterval(id);
  }, [flowPhase]);

  const goRetake = useCallback((reason: string) => {
    useSessionStore.getState().setPalmCaptureBase64(null);
    useSessionStore.getState().setPalmCaptureLandmarks(null, null);
    Alert.alert('Try again', reason, [
      {
        text: 'OK',
        onPress: () =>
          deferRouterReplace({
            pathname: '/onboarding/palm-scan',
            params: { retakeReason: encodeURIComponent(reason) },
          }),
      },
    ]);
  }, []);

  const finishReport = useCallback(
    async (palm: PalmAnalysisDto, resolvedSeed: string) => {
      setFlowPhase('reporting');
      setConfirmBusy(true);
      const snap = useSessionStore.getState();
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
        if (isApiConfigured()) {
          // Live backend failed — don't invent a frontend Life Blueprint.
          goRetake(PALM_RETAKE_DEFAULT);
          setConfirmBusy(false);
          return;
        }
        setPreviewReading(buildSimulatedReading(resolvedSeed, snap.focusTopics, palm));
      }

      track(AnalyticsEvent.REPORT_GENERATED, { mode: 'preview' });
      useSessionStore.getState().setSkipCloudRestore(false);
      void scheduleReadyNotification();
      useSessionStore.getState().setPalmCaptureLandmarks(null, null);
      await delay(ANALYSIS_SETTLE_MS);
      deferRouterReplace({
        pathname: '/onboarding/report-preview',
        params: { seed: resolvedSeed },
      });
    },
    [setPreviewReading, goRetake],
  );

  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const resolvedSeed = seed ?? `trace-${Date.now()}`;
    resolvedSeedRef.current = resolvedSeed;
    const started = Date.now();

    setReadingSeed(resolvedSeed);
    setPct(0);
    setSyncPulse(0);
    setPalmResult(null);
    setApiPalm(null);
    apiPalmRef.current = null;
    setSampleBadge(false);
    setFlowPhase('analyzing');
    setConfirmBusy(false);

    const snap0 = useSessionStore.getState();
    const captureSnapshot = snap0.palmCaptureBase64;
    const landmarksSnapshot = snap0.palmCaptureLandmarks;
    const landmarksSourceSnapshot = snap0.palmLandmarksSource;
    const genderSnapshot = snap0.userGender;
    const handSnapshot = snap0.palmScanHand ?? palmHandForGender(genderSnapshot);

    let cancelled = false;

    // Fixed 0 → 100 over ANALYSIS_MIN_DURATION_MS; never restart mid-run.
    const progressTick = setInterval(() => {
      const elapsed = Date.now() - started;
      const next = analysisProgressPct(elapsed, runMs);
      setPct(next);
      setSyncPulse(next / 100);
      setPalmResult(palmFieldsVisibleAt(elapsed, apiPalmRef.current, runMs));
      if (next >= 100) clearInterval(progressTick);
    }, 50);

    void (async () => {
      let needsRetake = false;
      let retakeReason = PALM_RETAKE_DEFAULT;
      let resolvedPalm: PalmAnalysisDto = FALLBACK_PALM;
      let awaitConfirm = false;
      let capture: string | null = null;

      /** API work only — must not navigate or finish the report (that would cut the 5.5s bar short). */
      const analyzeOnly = async () => {
        await bootstrapIdentity();
        await syncProfileRemote();
        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          throw new Error('missing_session');
        }

        capture = captureSnapshot ? trimBase64Payload(captureSnapshot) : null;
        if (isApiConfigured() && !capture) {
          needsRetake = true;
          retakeReason = 'The palm photo was lost before upload. Please scan again.';
          return;
        }

        // Review screen already locked lines (vision or CV) — reuse, skip re-analyze / re-confirm.
        const prelocked = snap.palmAnalysis;
        if (prelocked && !palmNeedsRetake(prelocked) && isLivePalmAnalysis(prelocked)) {
          resolvedPalm = prelocked;
          setApiPalm(prelocked);
          setPalmAnalysis(prelocked);
          awaitConfirm = false;
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
            // Live API is configured — never invent a frontend palm reading.
            needsRetake = true;
            retakeReason = PALM_RETAKE_DEFAULT;
            return;
          }
          palm = FALLBACK_PALM;
          setSampleBadge(true);
        }

        resolvedPalm = palm;
        setApiPalm(palm);
        setPalmAnalysis(palm);

        // Only re-confirm if review didn't already show lines.
        if (capture && hasPalmLineOverlay(palm)) {
          awaitConfirm = true;
        }
      };

      const waitForPresentation = async () => {
        const remaining = runMs - (Date.now() - started);
        if (remaining > 0) await delay(remaining);
      };

      try {
        await Promise.all([waitForPresentation(), analyzeOnly()]);
      } catch {
        if (cancelled || runId !== runIdRef.current) return;
        clearInterval(progressTick);
        setPct(100);
        setSyncPulse(1);
        await delay(ANALYSIS_SETTLE_MS);
        if (cancelled || runId !== runIdRef.current) return;
        // Live API configured → retake; offline-only may use a sample reading.
        if (isApiConfigured()) {
          goRetake(PALM_RETAKE_DEFAULT);
          return;
        }
        const snap = useSessionStore.getState();
        setSampleBadge(true);
        resolvedPalm = FALLBACK_PALM;
        setApiPalm(FALLBACK_PALM);
        setPalmAnalysis(FALLBACK_PALM);
        setPreviewReading(buildSimulatedReading(resolvedSeed, snap.focusTopics, FALLBACK_PALM));
        track(AnalyticsEvent.REPORT_GENERATED, { mode: 'preview', fallback: true });
        useSessionStore.getState().setSkipCloudRestore(false);
        setPalmResult(resolvedPalm);
        useSessionStore.getState().setPalmCaptureLandmarks(null, null);
        deferRouterReplace({
          pathname: '/onboarding/report-preview',
          params: { seed: resolvedSeed },
        });
        return;
      }

      if (cancelled || runId !== runIdRef.current) return;
      clearInterval(progressTick);
      setPalmResult(resolvedPalm);
      setPct(100);
      setSyncPulse(1);
      await delay(ANALYSIS_SETTLE_MS);
      if (cancelled || runId !== runIdRef.current) return;

      if (needsRetake) {
        goRetake(retakeReason);
        return;
      }
      if (awaitConfirm) {
        setFlowPhase('confirm');
        return;
      }
      // Only after the full 0→100 window — generate preview / navigate.
      await finishReport(resolvedPalm, resolvedSeed);
    })();

    return () => {
      cancelled = true;
      clearInterval(progressTick);
    };
  }, [seed, setPalmAnalysis, setPreviewReading, setReadingSeed, runMs, finishReport, goRetake]);

  const onConfirmLines = useCallback(async () => {
    const palm = apiPalm ?? palmResult;
    if (!palm || confirmBusy) return;
    await finishReport(palm, resolvedSeedRef.current);
  }, [apiPalm, palmResult, confirmBusy, finishReport]);

  const caption = ANALYSIS_LOADING_PHRASES[phase] ?? ANALYSIS_LOADING_PHRASES[0];

  const checklist: ChecklistItem[] = useMemo(() => {
    const p = palmResult;
    const lineDone = Boolean(hasPalmLineOverlay(p) && p?.life_line && p?.heart_line && p?.head_line);
    const mountsDone = Boolean(p?.mounts && Object.keys(p.mounts).length > 0);
    const shapeDone = Boolean(p?.hand_shape);
    const fingersDone = Boolean(p?.line_details || p?.fate_line);
    // Only mark done from real API fields — never fake progress from timer alone.
    return [
      { label: 'Major lines', state: lineDone ? 'done' : pct > 30 ? 'active' : 'pending' },
      { label: 'Mounts', state: mountsDone ? 'done' : pct > 55 ? 'active' : 'pending' },
      { label: 'Hand shape', state: shapeDone ? 'done' : pct > 78 ? 'active' : 'pending' },
      { label: 'Fine details', state: fingersDone ? 'done' : pct >= 100 && p ? 'active' : 'pending' },
    ];
  }, [palmResult, pct]);

  if (flowPhase === 'confirm' || flowPhase === 'reporting') {
    const geom = (apiPalm ?? palmResult)?.line_geometry ?? [];
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View className="flex-1 justify-between px-7 pb-10 pt-2">
            <OnboardingHeader step={ONBOARDING_STEPS.analysis} total={ONBOARDING_TOTAL_STEPS} showBack={false} />

            <View className="gap-3">
              <GradientText className="font-label text-[12px] uppercase tracking-[0.12em] text-cyan">
                {flowPhase === 'reporting' ? PALM_LINES_BUILDING : PALM_LINES_CONFIRM_TITLE}
              </GradientText>
              <Text className="font-body text-[14px] leading-6 text-on-surface-variant">
                {PALM_LINES_CONFIRM_SUBTITLE}
              </Text>
            </View>

            <View className="items-center">
              <View
                className="relative overflow-hidden rounded-3xl border border-white/15 bg-black/40"
                style={{ width: overlayWidth, height: overlayHeight }}>
                {palmCaptureBase64 ? (
                  <Image
                    source={{ uri: toImageUri(palmCaptureBase64) }}
                    style={{ width: overlayWidth, height: overlayHeight }}
                    resizeMode="cover"
                  />
                ) : null}
                {geom.length > 0 ? (
                  <PalmLineOverlay
                    geometry={geom}
                    width={overlayWidth}
                    height={overlayHeight}
                    imageWidth={imageSize?.width}
                    imageHeight={imageSize?.height}
                    resizeMode="cover"
                  />
                ) : null}
                <View className="absolute bottom-3 left-3 flex-row flex-wrap gap-2">
                  {palmLineLegend().map((item) => (
                    <View
                      key={item.key}
                      className="flex-row items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-1">
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <Text className="font-label text-[8px] uppercase tracking-[0.18em] text-white/80">
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="gap-3">
              <CosmicButton
                gradient="nebulaMd3"
                label={flowPhase === 'reporting' ? PALM_LINES_BUILDING : PALM_LINES_CONFIRM_CTA}
                disabled={confirmBusy || flowPhase === 'reporting'}
                onPress={() => void onConfirmLines()}
              />
              <CosmicButton
                variant="ghost"
                label={PALM_LINES_CONFIRM_RETAKE}
                disabled={confirmBusy || flowPhase === 'reporting'}
                onPress={() => goRetake(PALM_RETAKE_DEFAULT)}
              />
            </View>
          </View>
        </View>
      </CosmicScreen>
    );
  }

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
              <AnalyzingSeal diameter={244} hideCenterGlyph progress={pct} />
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

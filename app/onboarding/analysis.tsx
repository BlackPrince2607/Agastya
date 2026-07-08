import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { ReadingChecklist, type ChecklistItem } from '@/components/onboarding/ReadingChecklist';
import { AnalyzingSeal, GradientText } from '@/components/primitives';
import {
  ANALYSIS_LOADING_PHRASES,
  SAMPLE_READING_BADGE,
} from '@/constants/userCopy';
import { analyzePalm, generateReport } from '@/services/agastyaApi';
import { bootstrapIdentity, syncProfileRemote } from '@/services/identity';
import { normalizeFullReport } from '@/services/normalizeReport';
import { scheduleReadyNotification } from '@/services/notifications';
import { track } from '@/services/analytics';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { isApiConfigured } from '@/services/env';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import { useSessionStore } from '@/store/sessionStore';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS, ANALYSIS_PHRASE_MS } from '@/constants/onboarding';
import { deferRouterReplace } from '@/utils/routerDefer';
import { analysisPresentationMs, delay, palmFieldsVisibleAt } from '@/utils/analysisTiming';
import { withApiRetry } from '@/utils/apiRetry';
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
  const [pct, setPct] = useState(12);
  const [syncPulse, setSyncPulse] = useState(0.22);
  const [sampleBadge, setSampleBadge] = useState(false);
  const [palmResult, setPalmResult] = useState<PalmAnalysisDto | null>(null);
  const [apiPalm, setApiPalm] = useState<PalmAnalysisDto | null>(null);

  const runMs = analysisPresentationMs(ANALYSIS_LOADING_PHRASES.length);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - started;
      const next = Math.min(99, 12 + Math.floor((elapsed / runMs) * 88));
      setPct(next);
      setSyncPulse(0.18 + (next / 99) * 0.72);
      setPalmResult(palmFieldsVisibleAt(elapsed, apiPalm));
    }, 120);
    return () => clearInterval(tick);
  }, [runMs, apiPalm]);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % ANALYSIS_LOADING_PHRASES.length), ANALYSIS_PHRASE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const resolvedSeed = seed ?? `trace-${Date.now()}`;
    setReadingSeed(resolvedSeed);

    const minDelay = delay(runMs);

    let cancelled = false;

    void (async () => {
      let needsRetake = false;
      let resolvedPalm: PalmAnalysisDto = FALLBACK_PALM;

      const pipeline = async () => {
        await bootstrapIdentity();
        await syncProfileRemote();
        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          throw new Error('missing_session');
        }

        const captureRaw = snap.palmCaptureBase64;
        const capture = captureRaw ? trimBase64Payload(captureRaw) : null;
        let palm: PalmAnalysisDto = FALLBACK_PALM;
        try {
          palm = await withApiRetry(() =>
            analyzePalm({
              sessionId: snap.sessionId!,
              deviceInstallId: snap.deviceInstallId!,
              seed: resolvedSeed,
              imageBase64: capture,
              dominantHand: snap.palmScanHand ?? 'right',
            }),
          );
          resolvedPalm = palm;
          setApiPalm(palm);
          if (palmNeedsRetake(palm)) {
            needsRetake = true;
            return;
          }
          if (!isLivePalmAnalysis(palm)) {
            setSampleBadge(true);
          }
        } catch (err) {
          const online = isApiConfigured();
          if (online) {
            const msg = err instanceof Error ? err.message : 'Analysis failed';
            if (msg.toLowerCase().includes('retake') || msg.toLowerCase().includes('palm')) {
              needsRetake = true;
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
          setPreviewReading(buildSimulatedReading(resolvedSeed, snap.focusTopics));
        }

        track('analysis_pipeline_complete', { seed_len: resolvedSeed.length });
        useSessionStore.getState().setPalmCaptureBase64(null);
        useSessionStore.getState().setSkipCloudRestore(false);
        void scheduleReadyNotification();
      };

      try {
        await Promise.all([minDelay, pipeline()]);
      } catch {
        if (cancelled) return;
        const snap = useSessionStore.getState();
        setSampleBadge(true);
        resolvedPalm = FALLBACK_PALM;
        setApiPalm(FALLBACK_PALM);
        setPalmAnalysis(FALLBACK_PALM);
        setPreviewReading(buildSimulatedReading(resolvedSeed, snap.focusTopics));
        useSessionStore.getState().setSkipCloudRestore(false);
      } finally {
        if (cancelled) return;
        setPalmResult(resolvedPalm);
        if (needsRetake) {
          router.replace('/onboarding/palm-scan');
          return;
        }
        deferRouterReplace({
          pathname: '/onboarding/report-preview',
          params: { seed: resolvedSeed },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seed, setPalmAnalysis, setPreviewReading, setReadingSeed]);

  const caption = ANALYSIS_LOADING_PHRASES[phase] ?? ANALYSIS_LOADING_PHRASES[0];

  const checklist: ChecklistItem[] = useMemo(() => {
    const p = palmResult;
    const lineDone = Boolean(p?.life_line && p?.heart_line && p?.head_line);
    const mountsDone = Boolean(p?.mounts && Object.keys(p.mounts).length > 0);
    const shapeDone = Boolean(p?.hand_shape);
    const fingersDone = Boolean(p?.line_details || p?.fate_line);
    return [
      { label: 'Major Lines', state: lineDone ? 'done' : pct > 30 ? 'active' : 'pending' },
      { label: 'Mounts', state: mountsDone ? 'done' : pct > 55 ? 'active' : 'pending' },
      { label: 'Hand Shape', state: shapeDone ? 'done' : pct > 78 ? 'active' : 'pending' },
      { label: 'Finger Analysis', state: fingersDone ? 'done' : pct >= 99 ? 'active' : 'pending' },
    ];
  }, [palmResult, pct]);

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View className="flex-1 justify-between px-7 pb-16 pt-2">
          <OnboardingHeader step={ONBOARDING_STEPS.analysis} total={ONBOARDING_TOTAL_STEPS} showBack={false} />

          <View className="items-center gap-5">
            <GradientText className="font-label text-[12px] uppercase tracking-[0.12em] text-stitch-signal">
              Analyzing your palm
            </GradientText>
            {sampleBadge ? (
              <Text className="font-inter text-[12px] text-amber-200/90">{SAMPLE_READING_BADGE}</Text>
            ) : null}
            <View className="relative items-center justify-center">
              <AnalyzingSeal diameter={244} hideCenterGlyph />
              <View className="pointer-events-none absolute items-center justify-center gap-1">
                <Text className="font-space-grotesk text-[28px] font-semibold text-mist/95">{pct}%</Text>
                <Text className="font-space-grotesk text-[10px] uppercase tracking-[0.35em] text-md-on-surface-variant">
                  processing
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
                <Text className="font-space-grotesk text-[9px] uppercase tracking-[0.28em] text-md-on-primary-container">
                  Reading progress
                </Text>
                <Text className="font-inter text-[11px] text-stitch-signal/85">{pct}%</Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <View
                  className="h-full rounded-full bg-stitch-signal shadow-glow-teal"
                  style={{ width: `${Math.round(syncPulse * 100)}%` }}
                />
              </View>
            </View>

            <Text className="text-center font-body text-[13px] text-on-surface-variant">Almost ready</Text>
          </View>
        </View>
      </View>
    </CosmicScreen>
  );
}

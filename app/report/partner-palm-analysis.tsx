import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { AnalyzingSeal, GradientText } from '@/components/primitives';
import { ANALYSIS_LOADING_PHRASES, SAMPLE_READING_BADGE } from '@/constants/userCopy';
import { ANALYSIS_PHRASE_MS, ANALYSIS_SETTLE_MS } from '@/constants/onboarding';
import { analyzePalm } from '@/services/agastyaApi';
import { bootstrapIdentity } from '@/services/identity';
import { isApiConfigured } from '@/services/env';
import { isPalmRetakeError } from '@/services/apiErrors';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterReplace } from '@/utils/routerDefer';
import { analysisPresentationMs, analysisProgressPct, delay } from '@/utils/analysisTiming';
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

/** Analyze partner palm capture and return to compatibility screen. */
export default function PartnerPalmAnalysisScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const setPartnerPalmAnalysis = useSessionStore((s) => s.setPartnerPalmAnalysis);
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [sampleBadge, setSampleBadge] = useState(false);

  const runMs = analysisPresentationMs(ANALYSIS_LOADING_PHRASES.length);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % ANALYSIS_LOADING_PHRASES.length), ANALYSIS_PHRASE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const resolvedSeed = seed ?? `partner-${Date.now()}`;
    const started = Date.now();
    let cancelled = false;

    setPct(0);

    const progressTick = setInterval(() => {
      const elapsed = Date.now() - started;
      const next = analysisProgressPct(elapsed, runMs);
      setPct(next);
      if (next >= 100) clearInterval(progressTick);
    }, 50);

    void (async () => {
      const waitForPresentation = async () => {
        const remaining = runMs - (Date.now() - started);
        if (remaining > 0) await delay(remaining);
      };

      let needsRetake = false;

      const pipeline = async () => {
        await bootstrapIdentity();
        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          throw new Error('missing_session');
        }

        const captureRaw = snap.partnerPalmCaptureBase64;
        const capture = captureRaw ? trimBase64Payload(captureRaw) : null;
        const landmarksSnapshot = snap.partnerPalmCaptureLandmarks;
        const landmarksSourceSnapshot = snap.partnerPalmLandmarksSource;
        let palm: PalmAnalysisDto = FALLBACK_PALM;
        try {
          palm = await withApiRetry(() =>
            analyzePalm({
              sessionId: snap.sessionId!,
              deviceInstallId: snap.deviceInstallId!,
              seed: resolvedSeed,
              imageBase64: capture,
              dominantHand: snap.partnerPalmScanHand ?? 'right',
              landmarks: landmarksSnapshot ?? undefined,
              landmarksSource: landmarksSourceSnapshot ?? undefined,
            }),
          );
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
            if (isPalmRetakeError(msg)) {
              needsRetake = true;
              return;
            }
            throw err;
          }
          palm = FALLBACK_PALM;
          setSampleBadge(true);
        }

        setPartnerPalmAnalysis(palm);
        useSessionStore.setState({
          partnerPalmCaptureBase64: null,
          partnerPalmCaptureLandmarks: null,
          partnerPalmLandmarksSource: null,
        });
      };

      try {
        await Promise.all([waitForPresentation(), pipeline()]);
      } catch {
        if (cancelled) return;
        setSampleBadge(true);
        setPartnerPalmAnalysis(FALLBACK_PALM);
        useSessionStore.setState({
          partnerPalmCaptureBase64: null,
          partnerPalmCaptureLandmarks: null,
          partnerPalmLandmarksSource: null,
        });
      } finally {
        if (cancelled) return;
        clearInterval(progressTick);
        setPct(100);
        await delay(ANALYSIS_SETTLE_MS);
        if (cancelled) return;
        if (needsRetake) {
          Alert.alert(
            'Try again',
            "We couldn't read that palm clearly. Choose a brighter, open-palm photo.",
            [{ text: 'OK', onPress: () => deferRouterReplace('/report/partner-palm-scan' as never) }],
          );
          return;
        }
        deferRouterReplace('/report/compatibility' as never);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(progressTick);
    };
  }, [seed, setPartnerPalmAnalysis, runMs]);

  const caption = ANALYSIS_LOADING_PHRASES[phase] ?? ANALYSIS_LOADING_PHRASES[0];

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View className="flex-1 justify-between px-7 pb-16 pt-12">
          <View className="items-center gap-5">
            <GradientText className="font-label text-[12px] uppercase tracking-[0.5em] text-cyan">
              Reading partner palm
            </GradientText>
            {sampleBadge ? (
              <Text className="font-body text-[12px] text-amber-200/90">{SAMPLE_READING_BADGE}</Text>
            ) : null}
            <View className="relative items-center justify-center">
              <AnalyzingSeal diameter={220} hideCenterGlyph />
              <View className="pointer-events-none absolute items-center justify-center gap-1">
                <Text className="font-label text-[28px] font-semibold text-on-surface/95">{pct}%</Text>
                <Text className="font-label text-[10px] uppercase tracking-[0.35em] text-on-surface-variant">
                  processing
                </Text>
              </View>
            </View>
          </View>

          <MotiView key={phase} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Text className="text-center font-body text-[17px] font-medium leading-7 text-on-surface/95">{caption}</Text>
          </MotiView>
        </View>
      </View>
    </CosmicScreen>
  );
}

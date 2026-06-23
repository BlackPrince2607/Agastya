import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { AnalyzingSeal, GradientText } from '@/components/primitives';
import { ANALYSIS_LOADING_PHRASES, SAMPLE_READING_BADGE } from '@/constants/userCopy';
import { analyzePalm } from '@/services/agastyaApi';
import { bootstrapIdentity } from '@/services/identity';
import { isApiConfigured } from '@/services/env';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isLivePalmAnalysis, palmNeedsRetake } from '@/types/palmAnalysis';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterReplace } from '@/utils/routerDefer';
import { estimateLandmarksFromRoi, trimBase64Payload } from '@/utils/palmLandmarks';

const STEP_MS = 2200;

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
  const [pct, setPct] = useState(12);
  const [sampleBadge, setSampleBadge] = useState(false);

  const runMs = STEP_MS * ANALYSIS_LOADING_PHRASES.length + 800;

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - started;
      const next = Math.min(99, 12 + Math.floor((elapsed / runMs) * 88));
      setPct(next);
    }, 120);
    return () => clearInterval(tick);
  }, [runMs]);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % ANALYSIS_LOADING_PHRASES.length), STEP_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const resolvedSeed = seed ?? `partner-${Date.now()}`;
    let cancelled = false;

    void (async () => {
      const minDelay = new Promise<void>((resolve) => {
        setTimeout(resolve, STEP_MS * ANALYSIS_LOADING_PHRASES.length + 800);
      });

      let needsRetake = false;

      const pipeline = async () => {
        await bootstrapIdentity();
        const snap = useSessionStore.getState();
        if (!snap.sessionId || !snap.deviceInstallId) {
          throw new Error('missing_session');
        }

        const captureRaw = snap.partnerPalmCaptureBase64;
        const capture = captureRaw ? trimBase64Payload(captureRaw) : null;
        const landmarks = estimateLandmarksFromRoi();
        const online = isApiConfigured();

        let palm: PalmAnalysisDto = FALLBACK_PALM;
        try {
          palm = await analyzePalm({
            sessionId: snap.sessionId,
            deviceInstallId: snap.deviceInstallId,
            seed: resolvedSeed,
            imageBase64: capture,
            dominantHand: snap.partnerPalmScanHand ?? 'right',
            landmarks,
          });
          if (palmNeedsRetake(palm)) {
            needsRetake = true;
            return;
          }
          if (!isLivePalmAnalysis(palm)) {
            setSampleBadge(true);
          }
        } catch (err) {
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

        setPartnerPalmAnalysis(palm);
        useSessionStore.setState({ partnerPalmCaptureBase64: null });
      };

      try {
        await Promise.all([minDelay, pipeline()]);
      } catch {
        if (cancelled) return;
        setSampleBadge(true);
        setPartnerPalmAnalysis(FALLBACK_PALM);
        useSessionStore.setState({ partnerPalmCaptureBase64: null });
      } finally {
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
    };
  }, [seed, setPartnerPalmAnalysis]);

  const caption = ANALYSIS_LOADING_PHRASES[phase] ?? ANALYSIS_LOADING_PHRASES[0];

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View className="flex-1 justify-between px-7 pb-16 pt-12">
          <View className="items-center gap-5">
            <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.5em] text-stitch-signal">
              Reading partner palm
            </GradientText>
            {sampleBadge ? (
              <Text className="font-inter text-[12px] text-amber-200/90">{SAMPLE_READING_BADGE}</Text>
            ) : null}
            <View className="relative items-center justify-center">
              <AnalyzingSeal diameter={220} hideCenterGlyph />
              <View className="pointer-events-none absolute items-center justify-center gap-1">
                <Text className="font-space-grotesk text-[28px] font-semibold text-mist/95">{pct}%</Text>
                <Text className="font-space-grotesk text-[10px] uppercase tracking-[0.35em] text-md-on-surface-variant">
                  processing
                </Text>
              </View>
            </View>
          </View>

          <MotiView key={phase} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Text className="text-center font-inter text-[17px] font-medium leading-7 text-mist/95">{caption}</Text>
          </MotiView>
        </View>
      </View>
    </CosmicScreen>
  );
}

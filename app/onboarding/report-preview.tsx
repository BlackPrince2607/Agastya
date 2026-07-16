import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { DevPremiumPanel } from '@/components/dev/DevPremiumPanel';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import {
  AuraNebulaCard,
  BlurContainer,
  CosmicButton,
  GradientText,
  ReportInsightCard,
  MetricDonut,
} from '@/components/primitives';
import { PalmLineOverlay, palmLineLegend } from '@/components/report/PalmLineOverlay';
import { GlassCard } from '@/components/ui';
import { PAGE_PADDING } from '@/constants/layout';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { palmReadingChips } from '@/constants/userCopy';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { enterMainApp } from '@/utils/navigationFlow';
import { headlineNeedsPalmFix } from '@/utils/palmInsights';
import { hasPremiumAccess } from '@/utils/premiumAccess';

const FOCUS_LABEL: Record<FocusTopic, string> = {
  love: 'Love',
  career: 'Career',
  money: 'Money',
  growth: 'Growth',
  matching: 'Compatibility',
};

const LOCKED_PERKS = [
  'All life scores and your full aura',
  'Your complete bold prediction',
  'Unlimited Guide chats',
];

function toImageUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

export default function ReportPreviewScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const previewReading = useSessionStore((s) => s.previewReading);
  const storeSeed = useSessionStore((s) => s.readingSeed);
  const focus = useSessionStore((s) => s.focusTopics);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const palmCaptureBase64 = useSessionStore((s) => s.palmCaptureBase64);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const storePremium = useSessionStore((s) => s.hasUnlockedPremium);
  const mergedSeed = seed ?? storeSeed ?? 'stillness';
  const { isSignedIn } = useAuthSession();
  const premium = storePremium || hasPremiumAccess();
  const { width: windowWidth } = useWindowDimensions();
  const overlayWidth = Math.min(windowWidth - 48, 320);
  const overlayHeight = Math.round(overlayWidth * 0.55);

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!palmCaptureBase64) {
      setImageSize(null);
      return;
    }
    let cancelled = false;
    const uri = toImageUri(palmCaptureBase64);
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) setImageSize({ width, height });
      },
      () => {
        if (!cancelled) setImageSize({ width: 3, height: 4 });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [palmCaptureBase64]);

  const reading = useMemo(() => {
    const base = previewReading ?? buildSimulatedReading(mergedSeed, focus, palmAnalysis);
    if (palmAnalysis && previewReading && headlineNeedsPalmFix(previewReading.headline)) {
      return buildSimulatedReading(mergedSeed, focus, palmAnalysis);
    }
    return base;
  }, [previewReading, mergedSeed, focus, palmAnalysis]);
  const previewSections = reading.sections.slice(0, 2);
  const motifChips = palmAnalysis ? palmReadingChips(palmAnalysis) : null;
  const insets = useSafeAreaInsets();
  const hasScannedLines = Boolean(palmAnalysis?.line_geometry?.length);

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: 22,
            paddingBottom: 280 + insets.bottom,
            paddingHorizontal: PAGE_PADDING,
            paddingTop: 8,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.reportPreview} total={ONBOARDING_TOTAL_STEPS} />

          <DevPremiumPanel showOpenReport />

          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }}>
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="rounded-full border border-cyan/35 bg-cyan/10 px-3 py-1">
                <Text className="font-label text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan">
                  Preview
                </Text>
              </View>
              <GradientText className="font-label text-[11px] uppercase tracking-[0.42em] text-white/55">
                2 of 4 chapters
              </GradientText>
            </View>
            <Text className="mt-4 font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-on-surface/80">
              {reading.blueprintTitle}
            </Text>
            <Text className="mt-3 font-headline text-[30px] leading-9 tracking-tight text-on-surface">
              {reading.headline}
            </Text>
            {displayName?.trim() ? (
              <Text className="mt-2 font-body text-[14px] text-primary">
                Prepared for {displayName.trim()}
              </Text>
            ) : null}
            <Text className="mt-4 font-body text-[14px] leading-6 text-on-surface-variant">
              {isSignedIn
                ? 'Your preview is ready. Enter the app to keep exploring.'
                : 'Sign in to save your reading and enter the app.'}
            </Text>
          </MotiView>

          <GlassCard className="overflow-hidden border-primary/25 p-0">
            <LinearGradient
              colors={['rgba(121,246,255,0.12)', 'rgba(168,85,247,0.08)', 'rgba(5,2,14,0.55)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 22 }}>
              <GradientText className="font-label text-[10px] uppercase leading-5 tracking-[0.42em] text-magenta">
                {reading.visionaryTitle}
              </GradientText>
              <Text className="mt-3 font-headline-md text-[22px] leading-8 tracking-tight text-on-surface">
                {reading.visionarySubtitle}
              </Text>
              <Text className="mt-4 font-body text-[15px] leading-7 text-on-surface/90">{reading.archetypeLine}</Text>
            </LinearGradient>
          </GlassCard>

          {motifChips ? (
            <View className="flex-row flex-wrap gap-2">
              {motifChips.map((chip, i) => (
                <View
                  key={`${chip}-${i}`}
                  className="rounded-full border border-white/14 bg-white/[0.06] px-4 py-2">
                  <Text className="font-label text-[10px] font-medium tracking-wide text-on-surface/88">{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {hasScannedLines ? (
            <GlassCard className="overflow-hidden border-cyan/20 p-0">
              <View
                className="relative w-full overflow-hidden rounded-3xl bg-black/50"
                style={{ height: overlayHeight }}>
                {palmCaptureBase64 ? (
                  <Image
                    source={{ uri: toImageUri(palmCaptureBase64) }}
                    style={{ width: overlayWidth, height: overlayHeight, alignSelf: 'center' }}
                    resizeMode="cover"
                  />
                ) : null}
                <PalmLineOverlay
                  geometry={palmAnalysis!.line_geometry!}
                  width={overlayWidth}
                  height={overlayHeight}
                  imageWidth={imageSize?.width}
                  imageHeight={imageSize?.height}
                  resizeMode="cover"
                />
                <View className="absolute bottom-3 left-3 flex-row gap-2">
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
            </GlassCard>
          ) : palmAnalysis && palmAnalysis.geometry_source === 'unavailable' ? (
            <GlassCard className="border-amber-200/20 p-4">
              <Text className="font-body text-[14px] leading-6 text-on-surface/85">
                We couldn&apos;t lock your palm creases from this photo. Retake with an open palm and even light for a personalized line map.
              </Text>
              <View className="mt-3">
                <CosmicButton
                  variant="ghost"
                  label="Retake palm scan"
                  onPress={() =>
                    router.push({
                      pathname: '/onboarding/palm-scan',
                      params: { retakeReason: encodeURIComponent('Creases not detected — please retake.') },
                    })
                  }
                />
              </View>
            </GlassCard>
          ) : null}

          {focus.length > 0 ? (
            <View className="gap-2">
              <Text className="font-label text-[9px] uppercase tracking-[0.32em] text-on-primary-container">
                Your focus areas
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {focus.map((topic) => (
                  <View
                    key={topic}
                    className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1.5">
                    <Text className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan">
                      {FOCUS_LABEL[topic]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="gap-3">
            <Text className="font-label text-[9px] uppercase tracking-[0.32em] text-on-primary-container">
              Unlocked insights
            </Text>
            {previewSections.map((insight, idx) => (
              <MotiView
                key={insight.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: idx * 80 }}>
                <ReportInsightCard insight={insight} />
              </MotiView>
            ))}
          </View>

          <View className="relative overflow-hidden rounded-4xl border border-white/10">
            <GlassCard muted className="p-5 opacity-40">
              <Text
                className="font-label text-[10px] uppercase tracking-[0.35em] text-primary"
                style={{ lineHeight: 16, paddingTop: 2 }}>
                Life scores
              </Text>
              <Text className="mt-2 font-body text-[12px] leading-5 text-on-primary-container">
                Your scores across love, career, money, and growth.
              </Text>
              <View className="mt-8 flex-row flex-wrap justify-around gap-x-3 gap-y-8">
                <MetricDonut label="Love" value={reading.metrics.love} size={72} />
                <MetricDonut label="Career" value={reading.metrics.career} size={72} />
                <MetricDonut label="Money" value={reading.metrics.money} size={72} />
                <MetricDonut label="Growth" value={reading.metrics.growth} size={72} />
              </View>
            </GlassCard>
            <View className="absolute inset-0 items-center justify-center rounded-4xl bg-cosmic-void/78 px-7 py-5">
              <Text
                className="text-center font-label text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan"
                style={{ lineHeight: 18, paddingTop: 2 }}>
                Included with full access
              </Text>
              <Text className="mt-3 text-center font-body text-[14px] leading-6 text-on-surface/90">
                Your full scores, aura palette, and complete prediction unlock when you upgrade.
              </Text>
            </View>
          </View>

          <View className="relative overflow-hidden rounded-4xl" style={{ opacity: 0.82 }}>
            <AuraNebulaCard aura={reading.aura} />
            <View className="absolute inset-0 rounded-4xl bg-cosmic-void/35" />
          </View>

          <GlassCard className="overflow-visible border-cyan/20 p-5">
            <GradientText
              className="font-label text-[10px] uppercase leading-5 tracking-[0.38em]"
              textStyle={{ lineHeight: 20, paddingTop: 2 }}>
              Locked for now
            </GradientText>
            <Text className="mt-4 font-body text-[15px] leading-7 text-on-surface/75" numberOfLines={4}>
              {reading.boldPrediction}
            </Text>
            <View className="mt-5 gap-2.5 pb-1">
              {LOCKED_PERKS.map((perk) => (
                <View key={perk} className="flex-row items-start gap-3">
                  <View className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan/70" />
                  <Text className="flex-1 font-body text-[13px] leading-5 text-on-surface-variant">{perk}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </ScrollView>

        <BlurContainer
          intensity={56}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-none border-t border-white/14 bg-cosmic-void/92 px-6 pt-4"
          style={{ elevation: 24 }}>
          <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} className="gap-y-3">
            {isSignedIn ? (
              <>
                <CosmicButton gradient="nebulaMd3" label="Enter Agastya" onPress={() => enterMainApp()} />
                {!premium ? (
                  <CosmicButton
                    variant="ghost"
                    label="Unlock full report"
                    onPress={() =>
                      router.push({
                        pathname: '/onboarding/paywall',
                        params: { seed: mergedSeed },
                      })
                    }
                  />
                ) : null}
              </>
            ) : premium ? (
              <CosmicButton
                gradient="nebulaMd3"
                label="Save & sign in to continue"
                onPress={() =>
                  router.push({
                    pathname: '/onboarding/account',
                    params: { seed: mergedSeed },
                  })
                }
              />
            ) : (
              <CosmicButton
                gradient="nebulaMd3"
                label="Unlock full report"
                onPress={() =>
                  router.push({
                    pathname: '/onboarding/paywall',
                    params: { seed: mergedSeed },
                  })
                }
              />
            )}
            {!isSignedIn ? (
              <CosmicButton
                variant="ghost"
                label="Save & sign in"
                onPress={() =>
                  router.push({
                    pathname: '/onboarding/account',
                    params: { seed: mergedSeed },
                  })
                }
              />
            ) : null}
            <Text className="mt-1 text-center font-body text-[11px] leading-5 text-on-surface-variant">
              {isSignedIn
                ? premium
                  ? 'Your reading is saved on this device.'
                  : 'Home is unlocked. Upgrade anytime for the full report and Guide.'
                : 'Your preview stays on this device until you sign in.'}
            </Text>
          </View>
        </BlurContainer>
      </View>
    </CosmicScreen>
  );
}

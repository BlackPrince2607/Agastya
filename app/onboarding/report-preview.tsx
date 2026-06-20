import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import {
  AuraNebulaCard,
  BlurContainer,
  CosmicButton,
  GlowCard,
  GradientText,
  InsightCard,
  MetricDonut,
} from '@/components/primitives';
import { palmReadingChips } from '@/constants/userCopy';
import { isAuthBypassEnabled } from '@/services/authConfig';
import { buildSimulatedReading } from '@/services/simulatedReading';
import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { enterMainApp } from '@/utils/navigationFlow';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

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

export default function ReportPreviewScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const previewReading = useSessionStore((s) => s.previewReading);
  const storeSeed = useSessionStore((s) => s.readingSeed);
  const focus = useSessionStore((s) => s.focusTopics);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const mergedSeed = seed ?? storeSeed ?? 'stillness';

  const reading = previewReading ?? buildSimulatedReading(mergedSeed, focus);
  const previewSections = reading.sections.slice(0, 2);
  const motifChips = palmAnalysis ? palmReadingChips(palmAnalysis) : null;
  const insets = useSafeAreaInsets();

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
            paddingHorizontal: 24,
            paddingTop: 8,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.reportPreview} total={ONBOARDING_TOTAL_STEPS} />

          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }}>
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="rounded-full border border-stitch-signal/35 bg-stitch-signal/10 px-3 py-1">
                <Text className="font-space-grotesk text-[9px] font-semibold uppercase tracking-[0.22em] text-stitch-signal">
                  Preview
                </Text>
              </View>
              <GradientText className="font-space-grotesk text-[11px] uppercase tracking-[0.42em] text-white/55">
                2 of 4 chapters
              </GradientText>
            </View>
            <Text className="mt-4 font-space-grotesk text-[13px] font-semibold uppercase tracking-[0.12em] text-mist/80">
              {reading.blueprintTitle}
            </Text>
            <Text className="mt-3 font-noto-serif text-[32px] leading-[40px] tracking-tight text-mist">
              {reading.headline}
            </Text>
            {displayName?.trim() ? (
              <Text className="mt-2 font-inter text-[14px] text-stitch-signal/90">
                Prepared for {displayName.trim()}
              </Text>
            ) : null}
            <Text className="mt-4 font-inter text-[14px] leading-6 text-md-on-surface-variant">
              For entertainment and reflection only. Upgrade to unlock your complete report.
            </Text>
          </MotiView>

          <GlowCard className="overflow-hidden border-stitch-violet/25 p-0">
            <LinearGradient
              colors={['rgba(121,246,255,0.12)', 'rgba(168,85,247,0.08)', 'rgba(5,2,14,0.55)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 22 }}>
              <GradientText className="font-space-grotesk text-[10px] uppercase tracking-[0.42em] text-stitch-magenta">
                {reading.visionaryTitle}
              </GradientText>
              <Text className="mt-3 font-space-grotesk text-[22px] font-semibold leading-8 tracking-tight text-white">
                {reading.visionarySubtitle}
              </Text>
              <Text className="mt-4 font-inter text-[15px] leading-7 text-mist/90">{reading.archetypeLine}</Text>
            </LinearGradient>
          </GlowCard>

          {motifChips ? (
            <View className="flex-row flex-wrap gap-2">
              {motifChips.map((chip, i) => (
                <View
                  key={`${chip}-${i}`}
                  className="rounded-full border border-white/14 bg-white/[0.06] px-4 py-2">
                  <Text className="font-space-grotesk text-[10px] font-medium tracking-wide text-mist/88">{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {focus.length > 0 ? (
            <View className="gap-2">
              <Text className="font-space-grotesk text-[9px] uppercase tracking-[0.32em] text-md-on-primary-container">
                Your focus areas
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {focus.map((topic) => (
                  <View
                    key={topic}
                    className="rounded-full border border-stitch-signal/30 bg-stitch-signal/10 px-3 py-1.5">
                    <Text className="font-space-grotesk text-[10px] font-semibold uppercase tracking-[0.18em] text-stitch-signal">
                      {FOCUS_LABEL[topic]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="gap-3">
            <Text className="font-space-grotesk text-[9px] uppercase tracking-[0.32em] text-md-on-primary-container">
              Unlocked insights
            </Text>
            {previewSections.map((insight, idx) => (
              <MotiView
                key={insight.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: idx * 80 }}>
                <InsightCard insight={insight} />
              </MotiView>
            ))}
          </View>

          <View className="relative overflow-hidden rounded-4xl border border-white/10">
            <GlowCard muted className="opacity-40">
              <Text className="font-space-grotesk text-[10px] uppercase tracking-[0.35em] text-md-primary">
                Life scores
              </Text>
              <Text className="mt-2 font-inter text-[12px] text-md-on-primary-container">
                Symbolic scores, just for reflection and fun.
              </Text>
              <View className="mt-8 flex-row flex-wrap justify-around gap-x-3 gap-y-8">
                <MetricDonut label="Love" value={reading.metrics.love} size={72} />
                <MetricDonut label="Career" value={reading.metrics.career} size={72} />
                <MetricDonut label="Money" value={reading.metrics.money} size={72} />
                <MetricDonut label="Growth" value={reading.metrics.growth} size={72} />
              </View>
            </GlowCard>
            <View className="absolute inset-0 items-center justify-center rounded-4xl bg-cosmic-void/78 px-7">
              <Text className="text-center font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.28em] text-stitch-signal">
                Included with full access
              </Text>
              <Text className="mt-3 text-center font-inter text-[14px] leading-6 text-mist/90">
                Your full scores, aura palette, and complete prediction unlock when you upgrade.
              </Text>
            </View>
          </View>

          <View className="relative overflow-hidden rounded-4xl opacity-50">
            <AuraNebulaCard aura={reading.aura} />
            <View className="absolute inset-0 rounded-4xl bg-cosmic-void/55" />
          </View>

          <GlowCard className="border-stitch-signal/20">
            <GradientText className="font-space-grotesk text-[10px] uppercase tracking-[0.38em]">
              Locked for now
            </GradientText>
            <Text className="mt-4 font-inter text-[15px] leading-7 text-mist/75" numberOfLines={3}>
              {reading.boldPrediction}
            </Text>
            <View className="mt-5 gap-2">
              {LOCKED_PERKS.map((perk) => (
                <View key={perk} className="flex-row items-center gap-3">
                  <View className="h-1.5 w-1.5 rounded-full bg-stitch-signal/70" />
                  <Text className="font-inter text-[13px] text-md-on-surface-variant">{perk}</Text>
                </View>
              ))}
            </View>
          </GlowCard>
        </ScrollView>

        <BlurContainer
          intensity={56}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-none border-t border-white/14 bg-cosmic-void/92 px-6 pt-4"
          style={{ elevation: 24 }}>
          <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} className="gap-y-2.5">
            {isAuthBypassEnabled ? (
              <>
                <CosmicButton
                  gradient="nebulaMd3"
                  label="Continue to app"
                  onPress={() => enterMainApp()}
                />
                {!premium ? (
                  <CosmicButton
                    variant="ghost"
                    label="View plans"
                    onPress={() =>
                      router.push({
                        pathname: '/onboarding/paywall',
                        params: { seed: mergedSeed },
                      })
                    }
                  />
                ) : null}
                <Text className="mt-2 text-center font-inter text-[11px] leading-5 text-md-on-primary-container">
                  Dev access is on — sign-in is optional. Your reading stays on this device.
                </Text>
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
            {!isAuthBypassEnabled ? (
              <>
                <CosmicButton
                  variant="ghost"
                  label="Save & sync my reading"
                  onPress={() =>
                    router.push({
                      pathname: '/onboarding/account',
                      params: { seed: mergedSeed },
                    })
                  }
                />
                <Text className="mt-2 text-center font-inter text-[11px] leading-5 text-md-on-primary-container">
                  Sign in to access the app. Your reading preview is saved on this device.
                </Text>
              </>
            ) : null}
          </View>
        </BlurContainer>
      </View>
    </CosmicScreen>
  );
}

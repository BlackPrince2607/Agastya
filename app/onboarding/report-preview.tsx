import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MotiView } from '@/components/moti/MotiView';
import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_DOUBLE } from '@/components/layout/StickyActionBar';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import {
  AuraNebulaCard,
  CosmicButton,
  GradientText,
  ReportInsightCard,
  MetricDonut,
} from '@/components/primitives';
import { GlassCard } from '@/components/ui';
import { PAGE_PADDING } from '@/constants/layout';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { palmReadingChips } from '@/constants/userCopy';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { AnalyticsEvent, trackOnce } from '@/services/analytics';
import { enterMainApp } from '@/utils/navigationFlow';
import { normalizeLifeMetrics } from '@/utils/lifeMetrics';
import { headlineNeedsPalmFix } from '@/utils/palmInsights';
import { isEmailPremiumAllowlisted } from '@/utils/premiumAllowlist';

const FOCUS_LABEL: Record<FocusTopic, string> = {
  love: 'Love',
  career: 'Career',
  money: 'Money',
  growth: 'Growth',
  matching: 'Compatibility',
};

const LOCKED_PERKS = [
  'Every Blueprint chapter with measured line detail',
  'Your full outlook and aura profile',
  'Unlimited Agastya chat',
];

export default function ReportPreviewScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const previewReading = useSessionStore((s) => s.previewReading);
  const storeSeed = useSessionStore((s) => s.readingSeed);
  const focus = useSessionStore((s) => s.focusTopics);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const fullReading = useSessionStore((s) => s.fullReading);
  const mergedSeed = seed ?? storeSeed ?? 'stillness';
  const { isSignedIn } = useAuthSession();
  // Free skip: signed in with allowlisted email only. Paid: full report after checkout.
  // Never hide Unlock for unsigned users just because local hasUnlockedPremium is stale.
  const allowlistPremium = isSignedIn && isEmailPremiumAllowlisted();
  const hasConfirmedPremium = allowlistPremium || Boolean(fullReading);
  const showUnlockCta = !hasConfirmedPremium;

  // Drop leftover local unlocks when not signed in and not paid (no full report).
  useEffect(() => {
    if (isSignedIn) return;
    const snap = useSessionStore.getState();
    if (!snap.fullReading && snap.hasUnlockedPremium) {
      snap.setPremium(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    trackOnce(`report_preview_viewed:${mergedSeed}`, AnalyticsEvent.REPORT_PREVIEW_VIEWED, { mode: 'preview' });
  }, [mergedSeed]);

  const reading = useMemo(() => {
    const base = previewReading ?? buildSimulatedReading(mergedSeed, focus, palmAnalysis);
    const fixed =
      palmAnalysis && previewReading && headlineNeedsPalmFix(previewReading.headline)
        ? buildSimulatedReading(mergedSeed, focus, palmAnalysis)
        : base;
    return {
      ...fixed,
      metrics: normalizeLifeMetrics(fixed.metrics),
    };
  }, [previewReading, mergedSeed, focus, palmAnalysis]);
  const previewSections = reading.sections.slice(0, 2);
  const motifChips = palmAnalysis ? palmReadingChips(palmAnalysis) : null;
  const insets = useSafeAreaInsets();
  const [openInsightId, setOpenInsightId] = useState<string | null>(null);

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
            paddingBottom: STICKY_ACTION_BAR_DOUBLE + insets.bottom,
            paddingHorizontal: PAGE_PADDING,
            paddingTop: 8,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.reportPreview} total={ONBOARDING_TOTAL_STEPS} />

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
                ? showUnlockCta
                  ? 'Your preview is ready. Unlock Premium for the full Blueprint, or enter the app anytime.'
                  : 'Your preview is ready. Enter the app to keep exploring.'
                : showUnlockCta
                  ? 'Sign in, then unlock Premium for the full Blueprint — or save your reading first.'
                  : 'Sign in to sync your unlocked reading across devices.'}
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
                <ReportInsightCard
                  insight={insight}
                  expanded={openInsightId === insight.id}
                  onOpen={() => setOpenInsightId(insight.id)}
                  onClose={() => setOpenInsightId((id) => (id === insight.id ? null : id))}
                />
              </MotiView>
            ))}
          </View>

          <View className="relative overflow-hidden rounded-4xl border border-white/10">
            <GlassCard
              muted
              className="p-5 opacity-40"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Text
                className="font-label text-[10px] uppercase tracking-[0.35em] text-primary"
                style={{ lineHeight: 16, paddingTop: 2 }}>
                Life scores
              </Text>
              <Text className="mt-2 font-body text-[12px] leading-5 text-on-primary-container">
                Your scores across love, career, money, and growth.
              </Text>
              <View className="mt-8 flex-row flex-wrap justify-around gap-x-3 gap-y-8">
                <MetricDonut label="Love" metricKey="love" value={reading.metrics.love} size={72} />
                <MetricDonut label="Career" metricKey="career" value={reading.metrics.career} size={72} />
                <MetricDonut label="Money" metricKey="money" value={reading.metrics.money} size={72} />
                <MetricDonut label="Growth" metricKey="growth" value={reading.metrics.growth} size={72} />
              </View>
            </GlassCard>
            <View
              className="absolute inset-0 items-center justify-center rounded-4xl bg-cosmic-void/78 px-7 py-5"
              accessibilityLabel="Life scores locked. Included with full access. Your full scores, aura palette, and complete prediction unlock when you upgrade."
              accessibilityRole="text">
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

        <StickyActionBar contentStyle={{ gap: 12 }}>
          {showUnlockCta ? (
            <CosmicButton
              gradient="nebulaMd3"
              label="Unlock Premium"
              onPress={() =>
                router.push({
                  pathname: isSignedIn ? '/onboarding/paywall' : '/onboarding/account',
                  params: isSignedIn
                    ? { seed: mergedSeed }
                    : { seed: mergedSeed, toPaywall: '1' },
                })
              }
            />
          ) : null}
          {isSignedIn ? (
            <CosmicButton
              variant={showUnlockCta ? 'ghost' : 'primary'}
              label="Enter Agastya"
              onPress={() => enterMainApp()}
            />
          ) : (
            <CosmicButton
              variant={showUnlockCta ? 'ghost' : 'primary'}
              label={showUnlockCta ? 'Save & sign in' : 'Save & sign in to continue'}
              onPress={() =>
                router.push({
                  pathname: '/onboarding/account',
                  params: { seed: mergedSeed },
                })
              }
            />
          )}
          <Text className="text-center font-body text-[11px] leading-5 text-on-surface-variant">
            {isSignedIn
              ? showUnlockCta
                ? 'Home is unlocked. Upgrade anytime for the full report and Guide.'
                : 'Your reading is saved on this device.'
              : showUnlockCta
                ? 'Sign in first so Premium unlocks on your account after payment.'
                : 'Sign in to sync your unlocked reading across devices.'}
          </Text>
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/feedback';
import { BackButton } from '@/components/layout/BackButton';
import { StackScroll } from '@/components/layout/StackScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { EntertainmentDisclaimer } from '@/components/legal/EntertainmentDisclaimer';
import { AuraNebulaCard, GradientText, InsightCard, MetricDonut } from '@/components/primitives';
import { PalmLineCard, PredictionCard, StrengthDots } from '@/components/report';
import { PalmLineOverlay } from '@/components/report/PalmLineOverlay';
import { AuraChip, GlassCard, Icon, NebulaButton } from '@/components/ui';
import { fetchPredictions } from '@/services/agastyaApi';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useSessionStore } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { PREDICTION_PERIODS, type PredictionPeriod } from '@/types/predictions';
import { buildLocalPredictions } from '@/utils/localPredictions';
import { palmLineInsights, personalityProfile } from '@/utils/palmInsights';
import { paywallRouteParams } from '@/utils/paywallNavigation';

type ReportTab = 'overview' | 'lines' | 'personality' | 'predictions';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'lines', label: 'Lines' },
  { id: 'personality', label: 'Personality' },
  { id: 'predictions', label: 'Predictions' },
];

const FALLBACK_PALM: PalmAnalysisDto = {
  life_line: 'strong',
  heart_line: 'curved',
  head_line: 'long',
  personality: 'visionary',
  traits: ['creative', 'independent', 'intuitive', 'empathetic'],
};

export default function ReportScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const seed = useSessionStore((s) => s.readingSeed);
  const focuses = useSessionStore((s) => s.focusTopics);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const previewReading = useSessionStore((s) => s.previewReading);
  const fullReading = useSessionStore((s) => s.fullReading);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const predictionsCache = useSessionStore((s) => s.predictions);

  const initialTab = (TABS.find((t) => t.id === tab)?.id ?? 'overview') as ReportTab;
  const [active, setActive] = useState<ReportTab>(initialTab);
  const [period, setPeriod] = useState<PredictionPeriod>('month');

  useEffect(() => {
    const next = TABS.find((t) => t.id === tab)?.id;
    if (next) setActive(next as ReportTab);
  }, [tab]);

  const hasStoredReading = Boolean(previewReading || fullReading);
  const palm = palmAnalysis ?? FALLBACK_PALM;

  const dossier = useMemo(
    () => (premium ? fullReading ?? previewReading : previewReading) ?? buildSimulatedReading(seed ?? 'pulse', focuses),
    [premium, fullReading, previewReading, seed, focuses],
  );
  const lines = useMemo(() => palmLineInsights(palm, seed ?? 'lines'), [palm, seed]);
  const persona = useMemo(() => personalityProfile(palm, seed ?? 'persona'), [palm, seed]);

  const sessionId = useSessionStore((s) => s.sessionId);
  const focusTopics = useSessionStore((s) => s.focusTopics);
  const setPredictions = useSessionStore((s) => s.setPredictions);

  const periodUnlocked = premium || period === 'month';
  const predictions = useMemo(
    () => predictionsCache?.[period] ?? buildLocalPredictions(seed ?? 'pulse', period),
    [predictionsCache, period, seed],
  );

  // Fetch + cache real predictions when an unlocked period is viewed and not cached yet.
  useEffect(() => {
    if (active !== 'predictions' || !periodUnlocked) return;
    if (predictionsCache?.[period] || !sessionId || !palmAnalysis) return;
    let alive = true;
    void (async () => {
      try {
        const result = await fetchPredictions({
          sessionId,
          period,
          seed: seed ?? undefined,
          palmAnalysis,
          focusTopics,
        });
        if (alive) setPredictions(period, result);
      } catch {
        // Local fallback already renders; ignore network errors silently.
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, period, periodUnlocked, predictionsCache, sessionId, palmAnalysis, seed, focusTopics, premium, setPredictions]);

  if (!palmAnalysis && !hasStoredReading) {
    return (
      <CosmicScreen variant="stitch">
        <StackScroll>
          <ReportHeader />
          <EmptyState
            icon="file-text-o"
            title="Your palm report isn’t ready yet"
            body="Complete your palm scan to unlock your personalized report and scores."
            actionLabel="Start palm scan"
            onAction={() => router.push('/onboarding/palm-scan')}
          />
        </StackScroll>
      </CosmicScreen>
    );
  }

  const sections = premium ? dossier.sections : dossier.sections.slice(0, 2);

  return (
    <CosmicScreen variant="stitch">
      <StackScroll>
        <ReportHeader />

        {/* Pill tab bar */}
        <View className="flex-row flex-wrap gap-2">
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setActive(t.id)} className="active:opacity-80">
              <View
                className={`rounded-pill border px-5 py-2 ${
                  active === t.id ? 'border-transparent bg-primary/15' : 'border-white/12 bg-white/[0.04]'
                }`}>
                <Text
                  className="font-label text-[12px] uppercase tracking-[0.08em]"
                  style={{ color: active === t.id ? '#d3beeb' : 'rgba(203,196,206,0.8)' }}>
                  {t.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {active === 'overview' ? (
          <>
            <Text className="w-full font-headline text-[26px] text-on-surface">{dossier.blueprintTitle}</Text>
            <GlassCard glow className="w-full gap-2 p-5">
              <GradientText className="text-[12px] uppercase tracking-[0.3em]">{dossier.visionaryTitle}</GradientText>
              <Text className="mt-2 font-headline-md text-[22px] text-on-surface">{dossier.visionarySubtitle}</Text>
              <Text className="mt-3 font-body text-[15px] leading-7 text-on-surface-variant">{dossier.archetypeLine}</Text>
            </GlassCard>
            <GlassCard muted className={`w-full p-5 ${premium ? '' : 'opacity-80'}`}>
              <Text className="font-headline-md text-[18px] text-on-surface">Your metrics</Text>
              <View className="mt-6 flex-row flex-wrap justify-around gap-x-4 gap-y-8">
                <MetricDonut label="Love" value={dossier.metrics.love} />
                <MetricDonut label="Career" value={dossier.metrics.career} />
                <MetricDonut label="Money" value={dossier.metrics.money} />
                <MetricDonut label="Growth" value={dossier.metrics.growth} />
              </View>
            </GlassCard>
            <AuraNebulaCard aura={dossier.aura} />
            <GlassCard muted className="w-full gap-2 p-5">
              <Text className="font-headline-md text-[18px] text-on-surface">Outlook</Text>
              <Text className="font-body text-[16px] leading-7 text-on-surface-variant">{dossier.boldPrediction}</Text>
            </GlassCard>
            {sections.map((sec) => (
              <InsightCard key={sec.id} insight={sec} />
            ))}
            {!premium ? <UpgradeBanner /> : null}
          </>
        ) : null}

        {active === 'lines' ? (
          <>
            {palm.line_geometry?.length ? (
              <View className="relative h-56 w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                <PalmLineOverlay geometry={palm.line_geometry} width={320} height={224} />
              </View>
            ) : null}
            {lines.map((line) => (
              <PalmLineCard key={line.lineName} {...line} />
            ))}
          </>
        ) : null}

        {active === 'personality' ? (
          <>
            <GlassCard glow className="w-full items-center gap-5 p-6">
              <View className="items-center justify-center">
                <View
                  className="absolute h-32 w-32 rounded-full"
                  style={{
                    backgroundColor: 'rgba(168,85,247,0.15)',
                    shadowColor: '#a855f7',
                    shadowOpacity: 0.5,
                    shadowRadius: 20,
                  }}
                />
                <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-purple/50 bg-primary/15">
                  <Icon name="psychology" size={44} color="#c084fc" />
                </View>
              </View>
              <View className="flex-row flex-wrap justify-center gap-2">
                {persona.traits.map((t) => (
                  <AuraChip key={t} label={t} tint="#c084fc" />
                ))}
              </View>
              <Text className="text-center font-body text-[15px] leading-7 text-on-surface-variant">
                {persona.description}
              </Text>
            </GlassCard>

            <GlassCard muted className="w-full gap-3 p-5">
              <Text className="font-headline-md text-[18px] text-on-surface">Shadow Traits</Text>
              <View className="flex-row flex-wrap gap-2">
                {persona.shadowTraits.map((t) => (
                  <AuraChip key={t} label={t} tint="#f472b6" />
                ))}
              </View>
            </GlassCard>

            <GlassCard muted className="w-full gap-4 p-5">
              <Text className="font-headline-md text-[18px] text-on-surface">Your Strengths</Text>
              {persona.strengths.map((s) => (
                <StrengthDots key={s.label} label={s.label} value={s.value} />
              ))}
            </GlassCard>
          </>
        ) : null}

        {active === 'predictions' ? (
          <>
            <View className="flex-row gap-2">
              {PREDICTION_PERIODS.map((p) => (
                <Pressable key={p.id} onPress={() => setPeriod(p.id)} className="active:opacity-80">
                  <View
                    className={`rounded-pill border px-4 py-2 ${
                      period === p.id ? 'border-transparent bg-primary/15' : 'border-white/12 bg-white/[0.04]'
                    }`}>
                    <Text
                      className="font-label text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: period === p.id ? '#d3beeb' : 'rgba(203,196,206,0.8)' }}>
                      {p.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {predictions.items.map((item) => (
              <PredictionCard
                key={item.category}
                category={item.category}
                headline={item.headline}
                detail={item.detail}
                locked={!periodUnlocked}
              />
            ))}

            {!periodUnlocked ? (
              <GlassCard glow className="w-full items-center gap-3 p-5">
                <Text className="text-center font-headline-md text-[18px] text-on-surface">
                  Unlock longer-range predictions
                </Text>
                <Text className="text-center font-body text-[14px] text-on-surface-variant">
                  Go premium to reveal your 3-month and 1-year forecasts.
                </Text>
                <NebulaButton
                  variant="cta"
                  label="Go Premium"
                  onPress={() =>
                    router.push(paywallRouteParams('/report', useSessionStore.getState().readingSeed ?? undefined))
                  }
                />
              </GlassCard>
            ) : null}
          </>
        ) : null}

        <EntertainmentDisclaimer dense />
      </StackScroll>
    </CosmicScreen>
  );
}

function ReportHeader() {
  return (
    <View className="w-full flex-row items-center gap-3 px-1">
      <BackButton color="#c084fc" />
      <Text className="font-headline text-[22px] text-on-surface" accessibilityRole="header">
        Palm Report
      </Text>
    </View>
  );
}

function UpgradeBanner() {
  return (
    <GlassCard glow className="w-full items-center gap-3 p-5">
      <Text className="text-center font-headline-md text-[18px] text-on-surface">Preview mode</Text>
      <Text className="text-center font-body text-[14px] text-on-surface-variant">
        Upgrade for full scores, every chapter, and deeper predictions.
      </Text>
      <NebulaButton
        variant="cta"
        label="See plans"
        onPress={() => router.push(paywallRouteParams('/report', useSessionStore.getState().readingSeed ?? undefined))}
      />
    </GlassCard>
  );
}

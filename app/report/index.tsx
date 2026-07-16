import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '@/constants/theme';

import { DevPremiumPanel } from '@/components/dev/DevPremiumPanel';
import { EmptyState, LoadingBlock } from '@/components/feedback';
import { BackButton } from '@/components/layout/BackButton';
import { StackScroll } from '@/components/layout/StackScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { AuraNebulaCard, GradientText, InsightCard, MetricDonut } from '@/components/primitives';
import { PalmLineCard, PredictionCard, StrengthDots } from '@/components/report';
import { PalmLineOverlay, palmLineLegend } from '@/components/report/PalmLineOverlay';
import { AuraChip, GlassCard, Icon, PrimaryButton } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { REPORT_EMPTY, REPORT_PREDICTIONS_LOADING } from '@/constants/userCopy';
import { fetchPredictions } from '@/services/agastyaApi';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useSessionStore } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { PREDICTION_PERIODS, type PredictionPeriod } from '@/types/predictions';
import { buildLocalPredictions } from '@/utils/localPredictions';
import { withApiRetry } from '@/utils/apiRetry';
import { palmLineInsights, personalityProfile, headlineNeedsPalmFix } from '@/utils/palmInsights';
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

function toImageUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

export default function ReportScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const seed = useSessionStore((s) => s.readingSeed);
  const focuses = useSessionStore((s) => s.focusTopics);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const palmCaptureBase64 = useSessionStore((s) => s.palmCaptureBase64);
  const previewReading = useSessionStore((s) => s.previewReading);
  const fullReading = useSessionStore((s) => s.fullReading);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const predictionsCache = useSessionStore((s) => s.predictions);

  const initialTab = (TABS.find((t) => t.id === tab)?.id ?? 'overview') as ReportTab;
  const [active, setActive] = useState<ReportTab>(initialTab);
  const [period, setPeriod] = useState<PredictionPeriod>('month');
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const overlayWidth = Math.min(windowWidth - 48, 320);
  const overlayHeight = Math.round(overlayWidth * 0.7);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!palmCaptureBase64) {
      setImageSize(null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      toImageUri(palmCaptureBase64),
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

  useEffect(() => {
    const next = TABS.find((t) => t.id === tab)?.id;
    if (next) setActive(next as ReportTab);
  }, [tab]);

  const hasStoredReading = Boolean(previewReading || fullReading);
  const palm = palmAnalysis ?? FALLBACK_PALM;

  const dossier = useMemo(() => {
    const base =
      (premium ? fullReading ?? previewReading : previewReading) ??
      buildSimulatedReading(seed ?? 'pulse', focuses, palm);
    if (palmAnalysis && base && headlineNeedsPalmFix(base.headline)) {
      return buildSimulatedReading(seed ?? 'pulse', focuses, palm);
    }
    return base;
  }, [premium, fullReading, previewReading, seed, focuses, palm, palmAnalysis]);
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
    setPredictionsLoading(true);
    void (async () => {
      try {
        const result = await withApiRetry(() =>
          fetchPredictions({
            sessionId,
            period,
            seed: seed ?? undefined,
            palmAnalysis,
            focusTopics,
          }),
        );
        if (alive) setPredictions(period, result);
      } catch {
        // Local fallback already renders; ignore network errors silently.
      } finally {
        if (alive) setPredictionsLoading(false);
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
          <View className="w-full gap-5">
            <ReportHeader />
            <EmptyState
              icon="description"
              title={REPORT_EMPTY.title}
              body={REPORT_EMPTY.body}
              actionLabel={REPORT_EMPTY.action}
              onAction={() => router.push('/onboarding/palm-scan')}
            />
          </View>
        </StackScroll>
      </CosmicScreen>
    );
  }

  const sections = premium ? dossier.sections : dossier.sections.slice(0, 2);

  return (
    <CosmicScreen variant="stitch">
      <StackScroll>
        <View className="w-full gap-5">
          <ReportHeader />

          <DevPremiumPanel />

          {/* Pill tab bar */}
          <View className="w-full flex-row flex-wrap gap-2">
            {TABS.map((t) => (
              <PressableScale key={t.id} onPress={() => setActive(t.id)} scaleTo={0.97} accessibilityLabel={t.label}>
                <View
                  className={`rounded-pill border px-5 py-2 ${
                    active === t.id ? 'border-transparent bg-primary/15' : 'border-white/12 bg-white/[0.04]'
                  }`}>
                  <Text
                    className="font-label text-[12px] uppercase tracking-[0.08em]"
                    style={{ color: active === t.id ? colors.primary : 'rgba(203,196,206,0.8)' }}>
                    {t.label}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>

          {active === 'overview' ? (
            <View className="w-full gap-4">
              <Text className="w-full font-headline text-[26px] text-on-surface">{dossier.blueprintTitle}</Text>
              <GlassCard glow className="w-full p-5" innerClassName="gap-2.5">
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
              <GlassCard muted className="w-full p-5" innerClassName="gap-2.5">
                <Text className="font-headline-md text-[18px] text-on-surface">Outlook</Text>
                <Text className="font-body text-[16px] leading-7 text-on-surface-variant">{dossier.boldPrediction}</Text>
              </GlassCard>
              {sections.map((sec) => (
                <InsightCard key={sec.id} insight={sec} />
              ))}
              {!premium ? <UpgradeBanner /> : null}
            </View>
          ) : null}

          {active === 'lines' ? (
            <View className="w-full gap-4">
              {palm.confidence != null ? (
                <GlassCard muted className="w-full p-4" innerClassName="gap-2">
                  <Text className="font-label text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                    Reading confidence
                  </Text>
                  <Text className="font-headline-md text-[18px] text-on-surface">
                    {Math.round(palm.confidence * 100)}%
                  </Text>
                  {palm.fate_line ? (
                    <Text className="font-body text-[14px] text-on-surface-variant">
                      Fate line: {palm.fate_line}
                    </Text>
                  ) : null}
                  {palm.quality_warnings?.length ? (
                    <View className="mt-1 gap-1">
                      {palm.quality_warnings.map((w) => (
                        <Text key={w} className="font-body text-[13px] text-amber-200/90">
                          {w}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </GlassCard>
              ) : null}
              {palm.line_geometry?.length ? (
                <View className="gap-2">
                  <Text className="font-label text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                    Your palm lines
                  </Text>
                  <View
                    className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40"
                    style={{ height: overlayHeight }}>
                    {palmCaptureBase64 ? (
                      <Image
                        source={{ uri: toImageUri(palmCaptureBase64) }}
                        style={{ width: overlayWidth, height: overlayHeight, alignSelf: 'center' }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <PalmLineOverlay
                      geometry={palm.line_geometry}
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
                          <Text className="font-label text-[10px] uppercase tracking-[0.14em] text-white/85">
                            {item.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
              {lines.map((line) => (
                <PalmLineCard key={line.lineName} {...line} />
              ))}
            </View>
          ) : null}

          {active === 'personality' ? (
            <View className="w-full gap-4">
              <GlassCard glow className="w-full p-6" innerClassName="items-center gap-5">
                <View className="items-center justify-center">
                  <View
                    className="absolute h-32 w-32 rounded-full"
                    style={{
                      backgroundColor: 'rgba(168,85,247,0.15)',
                      shadowColor: colors.purple,
                      shadowOpacity: 0.5,
                      shadowRadius: 20,
                    }}
                  />
                  <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-purple/50 bg-primary/15">
                    <Icon name="psychology" size={44} color={colors.growth} />
                  </View>
                </View>
                <View className="flex-row flex-wrap justify-center gap-2">
                  {persona.traits.map((t) => (
                    <AuraChip key={t} label={t} tint={colors.growth} />
                  ))}
                </View>
                <Text className="text-center font-body text-[15px] leading-7 text-on-surface-variant">
                  {persona.description}
                </Text>
              </GlassCard>

              <GlassCard muted className="w-full p-5" innerClassName="gap-3">
                <Text className="font-headline-md text-[18px] text-on-surface">Growth edges</Text>
                <Text className="font-body text-[13px] leading-5 text-on-surface-variant">
                  Patterns worth watching with care — not flaws, invitations.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {persona.shadowTraits.map((t) => (
                    <AuraChip key={t} label={t} tint={colors.love} />
                  ))}
                </View>
              </GlassCard>

              <GlassCard muted className="w-full p-5" innerClassName="gap-4">
                <Text className="font-headline-md text-[18px] text-on-surface">Your strengths</Text>
                {persona.strengths.map((s) => (
                  <StrengthDots key={s.label} label={s.label} value={s.value} />
                ))}
              </GlassCard>
            </View>
          ) : null}

          {active === 'predictions' ? (
            <View className="w-full gap-4">
              <View className="w-full flex-row gap-2">
                {PREDICTION_PERIODS.map((p) => (
                  <PressableScale key={p.id} onPress={() => setPeriod(p.id)} scaleTo={0.97} accessibilityLabel={p.label}>
                    <View
                      className={`rounded-pill border px-4 py-2 ${
                        period === p.id ? 'border-transparent bg-primary/15' : 'border-white/12 bg-white/[0.04]'
                      }`}>
                      <Text
                        className="font-label text-[11px] uppercase tracking-[0.08em]"
                        style={{ color: period === p.id ? colors.primary : 'rgba(203,196,206,0.8)' }}>
                        {p.label}
                      </Text>
                    </View>
                  </PressableScale>
                ))}
              </View>

              {predictionsLoading && !predictionsCache?.[period] ? (
                <LoadingBlock variant="skeleton" compact message={REPORT_PREDICTIONS_LOADING} />
              ) : null}

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
                <GlassCard glow className="w-full p-5" innerClassName="items-center gap-3">
                  <Text className="text-center font-headline-md text-[18px] text-on-surface">
                    Unlock longer-range forecasts
                  </Text>
                  <Text className="text-center font-body text-[14px] text-on-surface-variant">
                    Go Pro to reveal your 3-month and 1-year outlook.
                  </Text>
                  <PrimaryButton
                    variant="cta"
                    label="Go Premium"
                    onPress={() =>
                      router.push(paywallRouteParams('/report', useSessionStore.getState().readingSeed ?? undefined))
                    }
                  />
                </GlassCard>
              ) : null}
            </View>
          ) : null}
        </View>
      </StackScroll>
    </CosmicScreen>
  );
}

function ReportHeader() {
  return (
    <View className="w-full flex-row items-center gap-3">
      <BackButton color={colors.growth} />
      <Text className="font-headline text-[22px] text-on-surface" accessibilityRole="header">
        Palm Report
      </Text>
    </View>
  );
}

function UpgradeBanner() {
  return (
    <GlassCard glow className="w-full p-5" innerClassName="items-center gap-3">
      <Text className="text-center font-headline-md text-[18px] text-on-surface">Preview mode</Text>
      <Text className="text-center font-body text-[14px] text-on-surface-variant">
        Upgrade for full scores, every chapter, and deeper forecasts.
      </Text>
      <PrimaryButton
        variant="cta"
        label="See plans"
        onPress={() => router.push(paywallRouteParams('/report', useSessionStore.getState().readingSeed ?? undefined))}
      />
    </GlassCard>
  );
}

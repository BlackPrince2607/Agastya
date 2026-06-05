import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { EmptyState, StatusPill } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { AuraNebulaCard, CosmicButton, GlowCard, GradientText, InsightCard, MetricDonut } from '@/components/primitives';
import { SAMPLE_READING_BADGE } from '@/constants/userCopy';
import { buildSimulatedReading } from '@/services/simulatedReading';
import { useSessionStore } from '@/store/sessionStore';

export default function LifeBlueprintScreen() {
  const displayName = useSessionStore((s) => s.userDisplayName);
  const seed = useSessionStore((s) => s.readingSeed);
  const focuses = useSessionStore((s) => s.focusTopics);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const previewReading = useSessionStore((s) => s.previewReading);
  const fullReading = useSessionStore((s) => s.fullReading);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);

  const hasStoredReading = Boolean(previewReading || fullReading);
  const isSample = !hasStoredReading && !palmAnalysis;

  if (!palmAnalysis && !hasStoredReading) {
    return (
      <CosmicScreen variant="stitch">
        <MainTabScroll>
          <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />
          <EmptyState
            icon="file-text-o"
            title="Your palm report isn’t ready yet"
            body="Complete your palm scan to unlock your personalized report and scores."
            actionLabel="Start palm scan"
            onAction={() => router.push('/onboarding/palm-scan')}
          />
        </MainTabScroll>
      </CosmicScreen>
    );
  }

  const dossier =
    (premium ? fullReading ?? previewReading : previewReading) ??
    buildSimulatedReading(seed ?? 'pulse', focuses);

  const sections = premium ? dossier.sections : dossier.sections.slice(0, Math.min(dossier.sections.length, 2));

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />
        <View className="w-full flex-row flex-wrap items-center gap-2">
          <Text className="font-inter-medium text-[22px] text-mist" accessibilityRole="header">
            Palm report
          </Text>
          {isSample ? <StatusPill label={SAMPLE_READING_BADGE} variant="info" /> : null}
        </View>
        {!premium ? (
          <GlowCard muted className="border-stitch-signal/35">
            <Text className="font-inter-medium text-[15px] text-mist">Preview mode</Text>
            <Text className="mt-2 text-[14px] text-md-on-surface-variant">
              Upgrade for full scores, metrics, and every chapter.
            </Text>
            <View className="mt-5">
              <CosmicButton gradient="nebulaMd3" label="See plans" onPress={() => router.push('/onboarding/paywall')} />
            </View>
          </GlowCard>
        ) : null}

        <Text className="w-full text-[26px] font-semibold tracking-tight text-mist">{dossier.blueprintTitle}</Text>
        <GlowCard>
          <GradientText className="text-[12px] uppercase tracking-[0.4em] text-stitch-magenta">
            {dossier.visionaryTitle}
          </GradientText>
          <Text className="mt-4 text-[22px] font-semibold tracking-tight text-white">{dossier.visionarySubtitle}</Text>
          <Text className="mt-5 text-[15px] leading-7 text-md-on-background">{dossier.archetypeLine}</Text>
        </GlowCard>

        <GlowCard muted className={premium ? '' : 'opacity-60'}>
          <Text className="font-inter-medium text-[15px] text-mist">Your metrics</Text>
          <View className="mt-6 flex-row flex-wrap justify-around gap-x-4 gap-y-8">
            <MetricDonut label="Love" value={dossier.metrics.love} />
            <MetricDonut label="Career" value={dossier.metrics.career} />
            <MetricDonut label="Money" value={dossier.metrics.money} />
            <MetricDonut label="Growth" value={dossier.metrics.growth} />
          </View>
        </GlowCard>

        <AuraNebulaCard aura={dossier.aura} />

        <GlowCard muted className={premium ? '' : 'opacity-55'}>
          <Text className="font-inter-medium text-[15px] text-mist">Outlook</Text>
          <Text className="mt-3 text-[16px] leading-7 text-md-on-background">{dossier.boldPrediction}</Text>
        </GlowCard>

        {sections.map((sec) => (
          <InsightCard key={sec.id} insight={sec} />
        ))}
      </MainTabScroll>
    </CosmicScreen>
  );
}

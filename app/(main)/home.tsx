import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { InlineError, StatusPill } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { GlassCard, Icon, NebulaButton, type IconName } from '@/components/ui';
import {
  buildDailyInsight,
  displayNameOrDefault,
  JOURNEY_DAY_FOOTNOTE,
  JOURNEY_DAY_LABEL,
  OFFLINE_LIMITED_LABEL,
} from '@/constants/userCopy';
import { getApiHealth } from '@/services/connectivity';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';

type Tool = { icon: IconName; label: string; hint?: string; onPress: () => void; wide?: boolean };

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Calendar days since the reading was first created (based on sessionStore taskDate / history). */
function calcJourneyDays(history: Record<string, string[]>): number {
  const dates = Object.keys(history).sort();
  if (!dates.length) return 1;
  const first = new Date(`${dates[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - first.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return Math.max(1, diffDays + 1);
}

export default function HomeDashboardScreen() {
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const syncNotice = useSessionStore((s) => s.syncNotice);
  const dismissedUpgrade = useSessionStore((s) => s.dismissedUpgradeCard);
  const setSyncNotice = useSessionStore((s) => s.setSyncNotice);
  const setDismissedUpgrade = useSessionStore((s) => s.setDismissedUpgradeCard);

  const streak = useTaskStore((s) => s.streak);
  const history = useTaskStore((s) => s.history);

  const quickInsight = useMemo(() => buildDailyInsight(palmAnalysis), [palmAnalysis]);
  // Real journey days from task completion history; streak shown as fire icon label
  const journeyDays = useMemo(() => calcJourneyDays(history), [history]);
  const apiLimited = getApiHealth()?.ok === false;

  const name = displayNameOrDefault(displayName);
  const greeting = name === 'Your profile' ? timeGreeting() : `${timeGreeting()}, ${name}`;

  const tools: Tool[] = [
    { icon: 'front_hand', label: 'Palm Report', onPress: () => router.push('/report') },
    { icon: 'auto_fix_high', label: 'AI Chat', onPress: () => router.push('/chat') },
    { icon: 'auto_graph', label: 'Predictions', onPress: () => router.push({ pathname: '/report', params: { tab: 'predictions' } }) },
    { icon: 'favorite', label: 'Compatibility', onPress: () => router.push('/report/compatibility') },
    {
      icon: 'task_alt',
      label: 'Daily Tasks',
      hint: 'Rituals to shape your future',
      onPress: () => router.push('/tasks'),
      wide: true,
    },
  ];

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />

        <View className="gap-1">
          <Text className="font-headline text-[26px] leading-8 text-on-surface" accessibilityRole="header">
            {greeting} <Text className="text-primary">✦</Text>
          </Text>
          <Text className="font-body text-[14px] text-on-surface-variant">Ready to shape your future?</Text>
        </View>

        {apiLimited ? <StatusPill label={OFFLINE_LIMITED_LABEL} variant="offline" /> : null}
        {syncNotice ? <InlineError message={syncNotice} onDismiss={() => setSyncNotice(null)} /> : null}

        {/* Scan CTA when no reading yet */}
        {!palmAnalysis ? (
          <GlassCard glow className="w-full p-5">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/20">
                <Icon name="front_hand" size={22} color="#d3beeb" />
              </View>
              <View className="flex-1">
                <Text className="font-headline-md text-[18px] text-on-surface">Start your palm reading</Text>
                <Text className="mt-0.5 font-body text-[13px] leading-5 text-on-surface-variant">
                  Scan your palm to unlock a personalized report, daily guidance, and your AI Guide.
                </Text>
              </View>
            </View>
            <View className="mt-4">
              <NebulaButton label="Scan my palm" onPress={() => router.push('/onboarding/palm-scan')} />
            </View>
          </GlassCard>
        ) : null}

        {/* Daily Insight (Stitch Daily Forecast) */}
        <GlassCard glow className="w-full p-5">
          <View pointerEvents="none" className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20" />
          <View className="relative gap-3">
            <View className="flex-row items-center gap-2">
              <Icon name="auto_awesome" size={18} color="#d3beeb" />
              <Text className="font-label text-[12px] uppercase tracking-[0.16em] text-primary">Daily Insight</Text>
            </View>
            <Text className="font-headline text-[24px] leading-8 text-on-surface">{quickInsight.title}</Text>
            <Text className="font-body text-[15px] leading-6 text-on-surface-variant" numberOfLines={4}>
              {quickInsight.body}
            </Text>
          </View>
        </GlassCard>

        {/* Upgrade nudge */}
        {!premium && !dismissedUpgrade ? (
          <GlassCard muted className="w-full p-4">
            <View className="flex-row items-center gap-2">
              <Pressable
                className="flex-1 active:opacity-90"
                onPress={() => router.push('/onboarding/paywall')}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro">
                <Text className="font-headline-md text-[16px] text-on-surface">Unlock your full potential</Text>
                <Text className="mt-0.5 font-body text-[13px] text-on-surface-variant">
                  Full report, predictions, compatibility, and unlimited chat
                </Text>
              </Pressable>
              <Pressable onPress={() => setDismissedUpgrade(true)} hitSlop={12} accessibilityLabel="Dismiss upgrade">
                <Icon name="close" size={16} color="rgba(232,225,229,0.4)" />
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        {/* Sacred Tools bento grid */}
        <Text className="mt-2 px-1 font-headline-md text-[20px] text-on-surface">Sacred Tools</Text>
        <View className="flex-row flex-wrap justify-between gap-3">
          {tools.map((tool) =>
            tool.wide ? (
              <Pressable
                key={tool.label}
                onPress={tool.onPress}
                className="w-full active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={tool.label}>
                <GlassCard className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary-container">
                      <Icon name={tool.icon} size={26} color="#d3beeb" />
                    </View>
                    <View>
                      <Text className="font-label text-[12px] uppercase tracking-[0.1em] text-on-surface">
                        {tool.label}
                      </Text>
                      {tool.hint ? (
                        <Text className="mt-0.5 font-body text-[12px] text-on-surface-variant">{tool.hint}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Icon name="chevron_right" size={22} color="#d3beeb" />
                </GlassCard>
              </Pressable>
            ) : (
              <Pressable
                key={tool.label}
                onPress={tool.onPress}
                style={{ width: '48%' }}
                className="active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={tool.label}>
                <GlassCard className="aspect-square items-center justify-center gap-2 p-4">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary-container">
                    <Icon name={tool.icon} size={28} color="#d3beeb" />
                  </View>
                  <Text className="font-label text-center text-[12px] uppercase tracking-[0.08em] text-on-surface">
                    {tool.label}
                  </Text>
                </GlassCard>
              </Pressable>
            ),
          )}
        </View>

        {/* Streak / Destiny Alignment */}
        <GlassCard className="flex-row items-center gap-4 p-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20">
            <Icon name="local_fire_department" size={24} color="#fb923c" />
          </View>
          <View className="flex-1">
            <Text className="font-headline-md text-[16px] text-on-surface">{JOURNEY_DAY_LABEL(journeyDays)}</Text>
            <Text className="mt-0.5 font-body text-[13px] text-on-surface-variant">{JOURNEY_DAY_FOOTNOTE}</Text>
          </View>
          {streak > 0 ? (
            <View className="items-center justify-center rounded-2xl bg-orange-500/20 px-3 py-1.5">
              <Text className="font-space-grotesk text-[18px] font-bold text-orange-400">{streak}</Text>
              <Text className="font-label text-[9px] uppercase tracking-widest text-orange-300/70">streak</Text>
            </View>
          ) : null}
        </GlassCard>
      </MainTabScroll>
    </CosmicScreen>
  );
}

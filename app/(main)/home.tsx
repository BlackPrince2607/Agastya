import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { InlineError, StatusPill } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { GlassCard, Icon, NebulaButton, ProgressBar, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';
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
import { initialsFor } from '@/utils/initials';

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
    { icon: 'auto_fix_high', label: 'Chat', onPress: () => router.push('/chat') },
    { icon: 'task_alt', label: 'Daily Tasks', onPress: () => router.push('/tasks') },
    { icon: 'auto_graph', label: 'Predictions', onPress: () => router.push({ pathname: '/report', params: { tab: 'predictions' } }) },
  ];

  const streakGoal = 7;
  const streakProgress = Math.min(100, Math.round((streak / streakGoal) * 100));

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />

        <View className="flex-row items-center gap-3">
          <View
            className="h-11 w-11 overflow-hidden rounded-full border border-purple/40"
            style={{ shadowColor: '#a855f7', shadowOpacity: 0.3, shadowRadius: 8 }}>
            <LinearGradient
              colors={['rgba(168,85,247,0.5)', 'rgba(232,121,249,0.35)']}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text className="font-label text-[13px] text-on-surface">{initialsFor(displayName)}</Text>
            </LinearGradient>
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-1.5">
              <Text className="font-headline text-[24px] leading-8 text-on-surface" accessibilityRole="header">
                {greeting}
              </Text>
              {palmAnalysis ? <Icon name="verified_user" size={18} color={colors.purple} /> : null}
            </View>
            <Text className="font-body text-[14px] text-on-surface-variant">Ready to shape your future?</Text>
          </View>
        </View>

        {apiLimited ? <StatusPill label={OFFLINE_LIMITED_LABEL} variant="offline" /> : null}
        {syncNotice ? <InlineError message={syncNotice} onDismiss={() => setSyncNotice(null)} /> : null}

        {/* Scan CTA when no reading yet */}
        {!palmAnalysis ? (
          <GlassCard glow className="w-full p-5">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/20">
                <Icon name="front_hand" size={22} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-headline-md text-[18px] text-on-surface">Start your palm reading</Text>
                <Text className="mt-1 font-body text-[13px] leading-5 text-on-surface-variant">
                  Scan your palm to unlock a personalized report, daily guidance, and your Guide.
                </Text>
              </View>
            </View>
            <View className="mt-5">
              <NebulaButton label="Scan my palm" onPress={() => router.push('/onboarding/palm-scan')} />
            </View>
          </GlassCard>
        ) : null}

        {/* Daily Insight */}
        <GlassCard glow className="w-full overflow-hidden p-5">
          <View pointerEvents="none" className="absolute -right-10 top-4 h-32 w-32 items-center justify-center">
            <View
              className="h-28 w-28 rounded-full"
              style={{
                backgroundColor: 'rgba(168,85,247,0.25)',
                shadowColor: '#a855f7',
                shadowOpacity: 0.6,
                shadowRadius: 24,
              }}
            />
            <View className="absolute h-16 w-16 rounded-full bg-purple/40" />
            <Icon name="person" size={28} color="rgba(255,255,255,0.5)" />
          </View>
          <View className="relative max-w-[72%] gap-3">
            <View className="flex-row items-center gap-2">
              <Icon name="auto_awesome" size={18} color={colors.purple} />
              <Text className="font-label text-[12px] uppercase tracking-[0.16em] text-primary">Daily Insight</Text>
            </View>
            <Text className="font-headline text-[22px] leading-8 text-on-surface">{quickInsight.title}</Text>
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

        {/* Quick Access */}
        <Text className="font-headline-md text-[20px] text-on-surface">Quick Access</Text>
        <View className="flex-row flex-wrap justify-between gap-3">
          {tools.map((tool) => (
            <Pressable
              key={tool.label}
              onPress={tool.onPress}
              style={{ width: '48%' }}
              className="active:opacity-90"
              accessibilityRole="button"
              accessibilityLabel={tool.label}>
              <GlassCard className="aspect-square items-center justify-center gap-3 p-4">
                <View
                  className="h-14 w-14 items-center justify-center rounded-2xl border border-white/10"
                  style={{ backgroundColor: 'rgba(168,85,247,0.12)' }}>
                  <Icon name={tool.icon} size={28} color={colors.purple} />
                </View>
                <Text className="font-label text-center text-[11px] uppercase tracking-[0.1em] text-on-surface">
                  {tool.label}
                </Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>

        {/* Streak */}
        <GlassCard className="gap-3 p-4">
          <View className="flex-row items-center gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple/20">
              <Icon name="local_fire_department" size={24} color={colors.purple} />
            </View>
            <View className="flex-1">
              <Text className="font-headline-md text-[16px] text-on-surface">
                {streak > 0 ? `${streak} Day Streak` : JOURNEY_DAY_LABEL(journeyDays)}
              </Text>
              <Text className="mt-0.5 font-body text-[13px] text-on-surface-variant">{JOURNEY_DAY_FOOTNOTE}</Text>
            </View>
            {streak > 0 ? (
              <Text className="font-space-grotesk text-[20px] font-bold text-primary">{streak}</Text>
            ) : null}
          </View>
          <ProgressBar value={streakProgress} height={8} palette="progress" />
        </GlassCard>
      </MainTabScroll>
    </CosmicScreen>
  );
}

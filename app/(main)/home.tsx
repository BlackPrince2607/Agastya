import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { InlineError, StatusPill } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { GlassCard, Icon, NebulaButton, ProgressBar, type IconName } from '@/components/ui';
import { MAIN_SECTION_GAP } from '@/constants/layout';
import { colors } from '@/constants/theme';
import {
  buildDailyInsight,
  displayNameOrDefault,
  HOME_SHORTCUTS,
  JOURNEY_DAY_FOOTNOTE,
  JOURNEY_DAY_LABEL,
  OFFLINE_LIMITED_LABEL,
  PROFILE_DEFAULT_NAME,
  type HomeShortcutAction,
} from '@/constants/userCopy';
import { getApiHealth } from '@/services/connectivity';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { paywallRouteParams } from '@/utils/paywallNavigation';

const SHORTCUT_ICONS: Record<HomeShortcutAction, IconName> = {
  report: 'description',
  guide: 'auto_fix_high',
  tasks: 'task_alt',
  compat: 'favorite',
  paywall: 'star',
};

function shortcutRoute(action: HomeShortcutAction) {
  switch (action) {
    case 'report':
      return () => router.push('/report');
    case 'guide':
      return () => router.push('/chat');
    case 'tasks':
      return () => router.push('/tasks');
    case 'compat':
      return () => router.push('/report/compatibility');
    case 'paywall':
      return () => router.push(paywallRouteParams('/(main)/home'));
  }
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  const journeyDays = useMemo(() => calcJourneyDays(history), [history]);
  const apiLimited = getApiHealth()?.ok === false;

  const name = displayNameOrDefault(displayName);
  const hasCustomName = name !== PROFILE_DEFAULT_NAME;
  const greeting = timeGreeting();

  const streakGoal = 7;
  const streakProgress = Math.min(100, Math.round((streak / streakGoal) * 100));

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll sectionGap={MAIN_SECTION_GAP}>
        <MainCosmicHeader displayName={displayName} />

        <View className="gap-1.5">
          <Text className="font-headline text-[26px] leading-8 text-on-surface" accessibilityRole="header">
            {greeting}
          </Text>
          {hasCustomName ? (
            <View className="min-w-0 flex-row items-center gap-2">
              <Text
                className="min-w-0 flex-1 font-headline-md text-[22px] leading-7 text-on-surface"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {name}
              </Text>
              {palmAnalysis ? <Icon name="verified_user" size={20} color={colors.purple} /> : null}
            </View>
          ) : null}
          <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
            {palmAnalysis ? 'Your reading is ready — explore today’s insight below.' : 'Scan your palm to unlock your personalized reading.'}
          </Text>
        </View>

        {apiLimited ? <StatusPill label={OFFLINE_LIMITED_LABEL} variant="offline" /> : null}
        {syncNotice ? <InlineError message={syncNotice} onDismiss={() => setSyncNotice(null)} /> : null}

        {!palmAnalysis ? (
          <GlassCard glow className="w-full p-5">
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/20">
                <Icon name="front_hand" size={22} color={colors.primary} />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-headline-md text-[18px] text-on-surface">Start your palm reading</Text>
                <Text className="font-body text-[14px] leading-5 text-on-surface-variant">
                  Scan or upload your palm to unlock a personalized report, daily guidance, and your Guide.
                </Text>
              </View>
            </View>
            <View className="mt-4">
              <NebulaButton label="Scan my palm" onPress={() => router.push('/onboarding/palm-scan')} />
            </View>
          </GlassCard>
        ) : null}

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
            <Icon name="auto_awesome" size={28} color="rgba(255,255,255,0.5)" />
          </View>
          <View className="relative min-w-0 max-w-[78%] gap-2.5">
            <View className="flex-row items-center gap-2">
              <Icon name="auto_awesome" size={18} color={colors.purple} />
              <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-primary">Daily insight</Text>
            </View>
            <Text className="font-headline text-[22px] leading-8 text-on-surface">{quickInsight.title}</Text>
            <Text className="font-body text-[15px] leading-6 text-on-surface-variant" numberOfLines={4}>
              {quickInsight.body}
            </Text>
          </View>
        </GlassCard>

        {!premium && !dismissedUpgrade ? (
          <GlassCard muted className="w-full p-4">
            <View className="flex-row items-center gap-2">
              <Pressable
                className="min-w-0 flex-1 active:opacity-90"
                onPress={() => router.push(paywallRouteParams('/(main)/home'))}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro">
                <Text className="font-headline-md text-[16px] text-on-surface">Unlock your full potential</Text>
                <Text className="mt-1 font-body text-[13px] leading-5 text-on-surface-variant">
                  Full report, predictions, compatibility, and unlimited chat
                </Text>
              </Pressable>
              <Pressable onPress={() => setDismissedUpgrade(true)} hitSlop={12} accessibilityLabel="Dismiss upgrade">
                <Icon name="close" size={16} color="rgba(232,225,229,0.4)" />
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        <View className="gap-3">
          <Text className="font-headline-md text-[20px] text-on-surface">Quick access</Text>
          <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
            {HOME_SHORTCUTS.map((shortcut) => (
              <Pressable
                key={shortcut.action}
                onPress={shortcutRoute(shortcut.action)}
                style={{ width: '48%' }}
                className="active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={shortcut.label}
                accessibilityHint={shortcut.hint}>
                <GlassCard className="w-full items-center gap-2.5 px-3 py-5">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10"
                    style={{ backgroundColor: 'rgba(168,85,247,0.15)' }}>
                    <Icon name={SHORTCUT_ICONS[shortcut.action]} size={26} color={colors.purple} />
                  </View>
                  <Text
                    className="text-center font-label text-[12px] uppercase tracking-[0.08em] text-on-surface"
                    numberOfLines={2}>
                    {shortcut.label}
                  </Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>

        <GlassCard className="gap-3 p-4">
            <View className="flex-row items-center gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple/20">
                <Icon name="local_fire_department" size={24} color={colors.purple} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-headline-md text-[16px] text-on-surface">
                  {streak > 0 ? `${streak} day streak` : JOURNEY_DAY_LABEL(journeyDays)}
                </Text>
                <Text className="mt-0.5 font-body text-[13px] leading-5 text-on-surface-variant">{JOURNEY_DAY_FOOTNOTE}</Text>
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

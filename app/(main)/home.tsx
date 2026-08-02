import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ContinueConversationCard } from '@/components/home/ContinueConversationCard';
import { HomeHero } from '@/components/home/HomeHero';
import { QuickAccessGrid, type QuickAccessItem } from '@/components/home/QuickAccessGrid';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { MotiView } from '@/components/moti/MotiView';
import { LoadingBlock, SectionHeader, InlineError } from '@/components/feedback';
import {
  GlassCard,
  Icon,
  InsightCard,
  PrimaryButton,
  ProgressCard,
  type IconName,
} from '@/components/ui';
import { MAIN_SECTION_GAP } from '@/constants/layout';
import { colors } from '@/constants/theme';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import {
  buildDailyInsight,
  displayNameOrDefault,
  HOME_CTA_BEGIN,
  HOME_CTA_READING,
  HOME_GUIDANCE_LOADING,
  HOME_SHORTCUTS,
  HOME_WEEKLY_LOADING,
  JOURNEY_DAY_FOOTNOTE,
  PROFILE_DEFAULT_NAME,
  type HomeShortcutAction,
} from '@/constants/userCopy';
import { fetchDailyGuidance, fetchWeeklySummary } from '@/services/agastyaApi';
import { ApiHttpError } from '@/services/apiErrors';
import { AnalyticsEvent, trackOnce, trackOncePerDay } from '@/services/analytics';
import {
  readThisWeeksLocalSummary,
  readTodaysLocalGuidance,
  writeLocalGuidance,
  writeLocalWeekly,
} from '@/services/guidanceCache';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { withApiRetry } from '@/utils/apiRetry';
import { utcTodayIso } from '@/utils/calendarDay';
import { shouldShowWeeklyOnHome } from '@/utils/calendarWeek';
import { paywallRouteParams } from '@/utils/paywallNavigation';
import { LOCAL_TASKS } from '@/utils/localTasks';

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
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function HomeSection({ children }: PropsWithChildren) {
  return <View className="w-full">{children}</View>;
}

export default function HomeDashboardScreen() {
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const sessionId = useSessionStore((s) => s.sessionId);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const dismissedUpgrade = useSessionStore((s) => s.dismissedUpgradeCard);
  const setDismissedUpgrade = useSessionStore((s) => s.setDismissedUpgradeCard);

  const streak = useTaskStore((s) => s.streak);
  const doneCount = useTaskStore((s) => {
    const list = s.tasks.length ? s.tasks : LOCAL_TASKS;
    return list.filter((t) => s.completedIds.includes(t.id)).length;
  });
  const storeTaskTotal = useTaskStore((s) => (s.tasks.length ? s.tasks.length : LOCAL_TASKS.length));
  const setFocusTheme = useTaskStore((s) => s.setFocusTheme);
  const lastChatTopic = useChatStore((s) => s.lastUserTopic);

  const fallbackInsight = useMemo(() => buildDailyInsight(palmAnalysis), [palmAnalysis]);
  const [guidance, setGuidance] = useState<{ title: string; body: string } | null>(null);
  const [weekly, setWeekly] = useState<{ title: string; body: string } | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [guidanceError, setGuidanceError] = useState(false);
  const [guidanceRetryKey, setGuidanceRetryKey] = useState(0);
  const [weeklyError, setWeeklyError] = useState(false);
  const [weeklyRetryKey, setWeeklyRetryKey] = useState(0);
  const [continueHint, setContinueHint] = useState<string | null>(null);
  const [consistencyNote, setConsistencyNote] = useState<string | null>(null);
  const hasLocalGuidance = useRef(false);
  const continueTopic = continueHint || lastChatTopic;

  // Single pass: local hydrate then network only on miss (guidance memo dedupes storage reads).
  useEffect(() => {
    let active = true;

    const load = async () => {
      const today = utcTodayIso();
      const local = await readTodaysLocalGuidance();
      if (!active) return;

      if (local) {
        hasLocalGuidance.current = true;
        setGuidance({ title: local.title, body: local.body });
        trackOncePerDay(AnalyticsEvent.TODAYS_GUIDANCE_VIEWED, { source: 'local_cache' });
        if (local.focusTheme) setFocusTheme(local.focusTheme);
        if (local.continueHint) setContinueHint(local.continueHint);
        if (local.consistencyNote) setConsistencyNote(local.consistencyNote);
        setGuidanceLoading(false);
        return;
      }

      if (!palmAnalysis || !sessionId) {
        if (!hasLocalGuidance.current) setGuidance(null);
        setGuidanceLoading(false);
        return;
      }

      setGuidanceLoading(true);
      setGuidanceError(false);
      try {
        const session = useSessionStore.getState();
        const result = await withApiRetry(() =>
          fetchDailyGuidance({
            sessionId,
            palmAnalysis,
            focusTopics: session.focusTopics ?? [],
            streak: useTaskStore.getState().streak > 0 ? useTaskStore.getState().streak : undefined,
          }),
        );
        if (!active || !result.title || !result.body) return;
        setGuidance({ title: result.title, body: result.body });
        setGuidanceError(false);
        if (result.continueHint) setContinueHint(result.continueHint);
        if (result.consistencyNote) setConsistencyNote(result.consistencyNote);
        hasLocalGuidance.current = true;
        trackOncePerDay(AnalyticsEvent.TODAYS_GUIDANCE_VIEWED, {
          source: result.cached ? 'remote_cache' : 'generated',
        });
        if (!result.cached) {
          trackOnce(`guidance_refreshed:${result.date || today}`, AnalyticsEvent.GUIDANCE_REFRESHED, {
            date: result.date || today,
          });
        }
        await writeLocalGuidance({
          date: result.date || today,
          title: result.title,
          body: result.body,
          focusTheme: result.focusTheme ?? null,
          continueHint: result.continueHint ?? null,
          consistencyNote: result.consistencyNote ?? null,
        });
        if (result.focusTheme) setFocusTheme(result.focusTheme);
      } catch (err) {
        if (__DEV__) {
          console.warn('[Agastya] daily guidance refresh failed', err);
        }
        // Production may lag behind app: missing /insights/daily → soft palm fallback, no banner.
        const missingRoute =
          err instanceof ApiHttpError &&
          (err.status === 404 || /"detail"\s*:\s*"not found"/i.test(err.rawDetail));
        if (active && !missingRoute) setGuidanceError(true);
      } finally {
        if (active) setGuidanceLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
    // Intentionally omit streak/focusTopics — they must not re-trigger guidance fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity-only refresh; guidanceRetryKey triggers manual retry
  }, [palmAnalysis, sessionId, setFocusTheme, guidanceRetryKey]);

  useEffect(() => {
    if (!palmAnalysis || !sessionId || !shouldShowWeeklyOnHome()) {
      setWeeklyLoading(false);
      return;
    }
    let active = true;
    setWeeklyLoading(true);
    setWeeklyError(false);
    void (async () => {
      const local = await readThisWeeksLocalSummary();
      if (!active) return;
      if (local) {
        setWeekly({ title: local.title, body: local.body });
        trackOnce(`weekly_summary_viewed:${local.weekKey}`, AnalyticsEvent.WEEKLY_SUMMARY_VIEWED, {
          source: 'home',
          week_key: local.weekKey,
        });
        setWeeklyLoading(false);
        return;
      }
      try {
        const res = await withApiRetry(() =>
          fetchWeeklySummary({
            sessionId,
            palmAnalysis,
            focusTopics: useSessionStore.getState().focusTopics ?? [],
            streak: useTaskStore.getState().streak > 0 ? useTaskStore.getState().streak : undefined,
          }),
        );
        if (!active || !res.title || !res.body) return;
        setWeekly({ title: res.title, body: res.body });
        trackOnce(`weekly_summary_viewed:${res.weekKey}`, AnalyticsEvent.WEEKLY_SUMMARY_VIEWED, {
          source: 'home',
          week_key: res.weekKey,
        });
        await writeLocalWeekly({
          weekKey: res.weekKey,
          title: res.title,
          body: res.body,
          topTheme: res.topTheme ?? null,
          consistencyNote: res.consistencyNote ?? null,
          currentChapter: res.currentChapter ?? null,
        });
      } catch {
        if (active) setWeeklyError(true);
      } finally {
        if (active) setWeeklyLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [palmAnalysis, sessionId, weeklyRetryKey]);

  // Palm-fallback insight still counts as viewing Today's Guidance.
  useEffect(() => {
    if (!palmAnalysis || guidanceLoading) return;
    if (guidance) return; // already tracked in load path
    trackOncePerDay(AnalyticsEvent.TODAYS_GUIDANCE_VIEWED, { source: 'palm_fallback' });
  }, [palmAnalysis, guidance, guidanceLoading]);

  const quickInsight = guidance ?? fallbackInsight;

  const name = displayNameOrDefault(displayName);
  const hasCustomName = name !== PROFILE_DEFAULT_NAME;
  const greeting = hasCustomName ? `${timeGreeting()}, ${name}` : timeGreeting();

  const allDoneToday = Boolean(palmAnalysis && storeTaskTotal > 0 && doneCount === storeTaskTotal);
  const taskTotal = palmAnalysis ? storeTaskTotal : 0;

  const progressFootnote =
    palmAnalysis && taskTotal > 0
      ? allDoneToday
        ? "All rituals complete. Today's wisdom is yours — come back tomorrow."
        : consistencyNote
          ? consistencyNote
          : streak > 1
            ? `You've stayed consistent for ${streak} days.`
            : "Complete all rituals to unlock today's wisdom."
      : JOURNEY_DAY_FOOTNOTE;

  const { tileMinHeight, gridGap } = useLayoutMetrics();

  const quickItems: QuickAccessItem[] = useMemo(
    () =>
      HOME_SHORTCUTS.map((shortcut) => ({
        action: shortcut.action,
        label: shortcut.label,
        subtitle: shortcut.subtitle,
        icon: SHORTCUT_ICONS[shortcut.action],
        onPress: shortcutRoute(shortcut.action),
        accessibilityHint: shortcut.hint,
      })),
    [],
  );

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll sectionGap={MAIN_SECTION_GAP}>
        <HomeSection>
          <MainCosmicHeader displayName={displayName} />
        </HomeSection>

        <HomeSection>
          <HomeHero greeting={greeting} />
        </HomeSection>

        {!palmAnalysis ? (
          <HomeSection>
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 450 }}>
              <GlassCard glow className="w-full" innerClassName="p-6">
                <View className="flex-row items-start gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
                    <Icon name="front_hand" size={24} color={colors.primary} />
                  </View>
                  <View className="min-w-0 flex-1 gap-1.5">
                    <Text className="font-headline-md text-[20px] text-on-surface">Start your palm reading</Text>
                    <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
                      Scan your palm to unlock your report, today’s guidance, and your AI Guide.
                    </Text>
                  </View>
                </View>
                <View className="mt-5">
                  <PrimaryButton label="Scan my palm" onPress={() => router.push('/onboarding/palm-scan')} />
                </View>
              </GlassCard>
            </MotiView>
          </HomeSection>
        ) : null}

        <HomeSection>
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 60 }}>
            {guidanceLoading && !guidance && palmAnalysis ? (
              <GlassCard glow className="w-full" innerClassName="p-5">
                <LoadingBlock variant="skeleton" compact message={HOME_GUIDANCE_LOADING} />
              </GlassCard>
            ) : (
              <View className="gap-2">
                {guidanceError && !guidance ? (
                  <InlineError
                    message="Couldn't refresh today's guidance — showing a palm-based fallback."
                    onRetry={() => setGuidanceRetryKey((k) => k + 1)}
                  />
                ) : null}
                <InsightCard
                  eyebrow="Today's Guidance"
                  title={quickInsight.title}
                  body={quickInsight.body}
                  ctaLabel={palmAnalysis ? HOME_CTA_READING : HOME_CTA_BEGIN}
                  onPress={() => router.push(palmAnalysis ? '/report' : '/onboarding/palm-scan')}
                />
              </View>
            )}
          </MotiView>
        </HomeSection>

        {weekly && palmAnalysis && shouldShowWeeklyOnHome() ? (
          <HomeSection>
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 480, delay: 90 }}>
              <InsightCard
                eyebrow="This Week's Guidance"
                title={weekly.title}
                body={weekly.body}
                ctaLabel={HOME_CTA_READING}
                onPress={() => router.push('/report')}
              />
            </MotiView>
          </HomeSection>
        ) : weeklyLoading && palmAnalysis && shouldShowWeeklyOnHome() ? (
          <HomeSection>
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 480, delay: 90 }}>
              <GlassCard glow className="w-full" innerClassName="p-5">
                <LoadingBlock variant="skeleton" compact message={HOME_WEEKLY_LOADING} />
              </GlassCard>
            </MotiView>
          </HomeSection>
        ) : weeklyError && palmAnalysis && shouldShowWeeklyOnHome() ? (
          <HomeSection>
            <InlineError
              message="Couldn't load this week's guidance."
              onRetry={() => setWeeklyRetryKey((k) => k + 1)}
            />
          </HomeSection>
        ) : null}

        {continueTopic ? (
          <HomeSection>
            <ContinueConversationCard
              topic={continueTopic}
              onContinue={() =>
                router.push({
                  pathname: '/chat',
                  params: { icebreaker: continueTopic },
                })
              }
            />
          </HomeSection>
        ) : null}

        {!premium && !dismissedUpgrade ? (
          <HomeSection>
            <GlassCard muted className="w-full" innerClassName="flex-row items-center gap-2 p-4">
              <Pressable
                className="min-w-0 flex-1 active:opacity-90"
                onPress={() => router.push(paywallRouteParams('/(main)/home'))}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro">
                <Text className="font-headline-md text-[16px] text-on-surface">Unlock your full Life Blueprint</Text>
                <Text className="mt-1 font-body text-[13px] leading-5 text-on-surface-variant">
                  Full report chapters, long-range forecasts, compatibility, and unlimited chat.
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDismissedUpgrade(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Dismiss upgrade"
                className="h-11 w-11 shrink-0 items-center justify-center active:opacity-80">
                <Icon name="close" size={16} color="rgba(232,225,229,0.4)" />
              </Pressable>
            </GlassCard>
          </HomeSection>
        ) : null}

        <HomeSection>
          <SectionHeader title="Quick access" subtitle="Jump into what matters most today" />
          <View className="mt-4">
            <QuickAccessGrid items={quickItems} tileMinHeight={Math.max(tileMinHeight, 132)} gap={gridGap} />
          </View>
        </HomeSection>

        <HomeSection>
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 480, delay: 180 }}>
            {palmAnalysis ? (
              <ProgressCard
                completed={doneCount}
                total={taskTotal > 0 ? taskTotal : 3}
                footnote={progressFootnote}
                streak={streak > 0 ? streak : undefined}
                value={taskTotal > 0 ? Math.round((doneCount / taskTotal) * 100) : 0}
              />
            ) : (
              <ProgressCard
                completed={0}
                total={0}
                footnote="Scan to begin rituals"
                emptyLabel="Scan to begin rituals"
              />
            )}
          </MotiView>
        </HomeSection>
      </MainTabScroll>
    </CosmicScreen>
  );
}

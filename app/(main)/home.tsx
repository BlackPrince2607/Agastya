import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ContinueConversationCard } from '@/components/home/ContinueConversationCard';
import { HomeHero } from '@/components/home/HomeHero';
import { QuickAccessGrid, type QuickAccessItem } from '@/components/home/QuickAccessGrid';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { MotiView } from '@/components/moti/MotiView';
import { SectionHeader } from '@/components/feedback';
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
  HOME_SHORTCUTS,
  JOURNEY_DAY_FOOTNOTE,
  PROFILE_DEFAULT_NAME,
  type HomeShortcutAction,
} from '@/constants/userCopy';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
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

function lastUserTopic(messages: { role: string; text: string }[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'you' && msg.text.trim()) {
      const trimmed = msg.text.trim();
      return trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
    }
  }
  return null;
}

export default function HomeDashboardScreen() {
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const dismissedUpgrade = useSessionStore((s) => s.dismissedUpgradeCard);
  const setDismissedUpgrade = useSessionStore((s) => s.setDismissedUpgradeCard);

  const streak = useTaskStore((s) => s.streak);
  const tasks = useTaskStore((s) => s.tasks);
  const completedIds = useTaskStore((s) => s.completedIds);
  const chatMessages = useChatStore((s) => s.messages);

  const quickInsight = useMemo(() => buildDailyInsight(palmAnalysis), [palmAnalysis]);
  const continueTopic = useMemo(() => lastUserTopic(chatMessages), [chatMessages]);

  const name = displayNameOrDefault(displayName);
  const hasCustomName = name !== PROFILE_DEFAULT_NAME;
  const greeting = hasCustomName ? `${timeGreeting()}, ${name}` : timeGreeting();

  const taskList = palmAnalysis ? (tasks.length ? tasks : LOCAL_TASKS) : [];
  const doneCount = taskList.filter((t) => completedIds.includes(t.id)).length;
  const taskTotal = taskList.length;
  const allDoneToday = taskTotal > 0 && doneCount === taskTotal;

  const progressFootnote =
    palmAnalysis && taskTotal > 0
      ? allDoneToday
        ? "All rituals complete. Today's wisdom is yours — come back tomorrow."
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
              <GlassCard glow className="w-full p-6">
                <View className="flex-row items-start gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
                    <Icon name="front_hand" size={24} color={colors.primary} />
                  </View>
                  <View className="min-w-0 flex-1 gap-1.5">
                    <Text className="font-headline-md text-[20px] text-on-surface">Start your palm reading</Text>
                    <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
                      Scan or upload your palm to unlock your report, daily guidance, and AI Guide.
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
            <InsightCard
              title={quickInsight.title}
              body={quickInsight.body}
              ctaLabel={palmAnalysis ? 'Read Full Reading' : 'Begin Your Reading'}
              onPress={() => router.push(palmAnalysis ? '/report' : '/onboarding/palm-scan')}
            />
          </MotiView>
        </HomeSection>

        {continueTopic ? (
          <HomeSection>
            <ContinueConversationCard topic={continueTopic} onContinue={() => router.push('/chat')} />
          </HomeSection>
        ) : null}

        {!premium && !dismissedUpgrade ? (
          <HomeSection>
            <GlassCard muted className="w-full p-4" innerClassName="flex-row items-center gap-2">
              <Pressable
                className="min-w-0 flex-1 active:opacity-90"
                onPress={() => router.push(paywallRouteParams('/(main)/home'))}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro">
                <Text className="font-headline-md text-[16px] text-on-surface">Unlock your full reading</Text>
                <Text className="mt-1 font-body text-[13px] leading-5 text-on-surface-variant">
                  Full report, predictions, compatibility, and unlimited chat.
                </Text>
              </Pressable>
              <Pressable onPress={() => setDismissedUpgrade(true)} hitSlop={12} accessibilityLabel="Dismiss upgrade">
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
            <ProgressCard
              completed={doneCount}
              total={taskTotal > 0 ? taskTotal : 3}
              footnote={progressFootnote}
              streak={streak > 0 ? streak : undefined}
              value={taskTotal > 0 ? Math.round((doneCount / taskTotal) * 100) : 0}
            />
          </MotiView>
        </HomeSection>
      </MainTabScroll>
    </CosmicScreen>
  );
}

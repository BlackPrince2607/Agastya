import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { colors } from '@/constants/theme';

import { EmptyState, LoadingBlock, PageTitle, PremiumLockGate } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { ProgressRing } from '@/components/tasks/ProgressRing';
import { TaskCard } from '@/components/tasks/TaskCard';
import { GlassCard, Icon } from '@/components/ui';
import {
  TASKS_ALL_DONE,
  TASKS_EMPTY_NO_PALM,
  TASKS_LOADING,
  TASKS_PROGRESS_HINT,
} from '@/constants/userCopy';
import { fetchDailyTasks, submitDailyReflection } from '@/services/agastyaApi';
import { scheduleDailyTaskReminder, cancelDailyTaskReminder } from '@/services/notifications';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { isTabRoute } from '@/utils/isTabRoute';
import { LOCAL_TASKS, ensureEveningReflection, normalizeTask } from '@/utils/localTasks';
import { withApiRetry } from '@/utils/apiRetry';
import { utcTodayIso } from '@/utils/calendarDay';

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TasksScreen() {
  const pathname = usePathname();
  const displayName = useSessionStore((s) => s.userDisplayName);
  const sessionId = useSessionStore((s) => s.sessionId);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);

  const tasks = useTaskStore((s) => s.tasks);
  const completedIds = useTaskStore((s) => s.completedIds);
  const taskDate = useTaskStore((s) => s.taskDate);
  const focusTheme = useTaskStore((s) => s.focusTheme);
  const setTasks = useTaskStore((s) => s.setTasks);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);

  const [loading, setLoading] = useState(false);
  const [reflectionSyncError, setReflectionSyncError] = useState(false);

  const markComplete = (id: string) => {
    const wasComplete = completedIds.includes(id);
    toggleComplete(id);
    if (!wasComplete && id === 'evening-reflection' && sessionId) {
      setReflectionSyncError(false);
      void submitDailyReflection({ sessionId }).catch(() => {
        setReflectionSyncError(true);
      });
    }
  };

  const isoToday = utcTodayIso();
  const list = tasks.length ? tasks : LOCAL_TASKS;
  const doneCount = list.filter((t) => completedIds.includes(t.id)).length;
  const allDone = doneCount === list.length && list.length > 0;

  const focusSubtitle = useMemo(() => {
    const labels: Record<string, string> = {
      career: 'Today’s Focus · Career',
      love: 'Today’s Focus · Relationships',
      money: 'Today’s Focus · Money',
      growth: 'Today’s Focus · Personal Growth',
    };
    const themeLabel = focusTheme ? labels[focusTheme] : null;
    return themeLabel ? `${themeLabel} · ${formatToday()}` : formatToday();
  }, [focusTheme]);

  useEffect(() => {
    if (!isTabRoute(pathname, 'tasks')) return;
    let active = true;

    const load = async () => {
      if (!palmAnalysis) return;

      if (!sessionId) {
        if (tasks.length === 0 || taskDate !== isoToday) {
          setTasks(ensureEveningReflection(LOCAL_TASKS), 'fallback', isoToday);
        }
        return;
      }

      if (tasks.length && taskDate === isoToday) return;
      setLoading(true);
      try {
        const snap = useSessionStore.getState();
        const streakNow = useTaskStore.getState().streak;
        const payload = await withApiRetry(() =>
          fetchDailyTasks({
            sessionId,
            palmAnalysis,
            focusTopics: snap.focusTopics ?? [],
            streak: streakNow > 0 ? streakNow : undefined,
          }),
        );
        if (active) {
          const normalized = ensureEveningReflection(payload.tasks.map((t, i) => normalizeTask(t, i)));
          setTasks(
            normalized.length ? normalized : ensureEveningReflection(LOCAL_TASKS),
            payload.variant,
            isoToday,
            payload.focusTheme ?? null,
          );
        }
      } catch {
        if (active) {
          setTasks(ensureEveningReflection(LOCAL_TASKS), 'fallback', isoToday);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [pathname, tasks.length, taskDate, isoToday, palmAnalysis, sessionId, setTasks]);

  // Schedule (or cancel) the daily reminder based on completion state.
  useEffect(() => {
    if (allDone) {
      void cancelDailyTaskReminder();
    } else if (list.length > 0) {
      void scheduleDailyTaskReminder();
    }
  }, [allDone, list.length]);

  if (!premium) {
    return (
      <PremiumLockGate
        title="Daily rituals are a Pro feature"
        body="Unlock personalized rituals tied to your palm reading and focus areas."
      />
    );
  }

  if (!palmAnalysis) {
    return (
      <CosmicScreen variant="stitch">
        <MainTabScroll>
          <MainCosmicHeader displayName={displayName} />
          <EmptyState
            icon="task_alt"
            title={TASKS_EMPTY_NO_PALM.title}
            body={TASKS_EMPTY_NO_PALM.body}
            actionLabel={TASKS_EMPTY_NO_PALM.action}
            onAction={() => router.push('/onboarding/palm-scan')}
          />
        </MainTabScroll>
      </CosmicScreen>
    );
  }

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <MainCosmicHeader displayName={displayName} />

        <PageTitle title="Today’s Rituals" subtitle={focusSubtitle} />

        {reflectionSyncError ? (
          <Text className="mb-2 px-1 font-body text-[13px] text-on-surface-variant">
            Ritual saved on this device, but we couldn&apos;t sync your reflection to the cloud. It will retry next time
            you&apos;re online.
          </Text>
        ) : null}

        <View className="items-center overflow-visible py-2">
          <ProgressRing done={doneCount} total={list.length} />
          <Text className="mt-3 font-body text-[14px] text-on-surface-variant">
            {loading ? TASKS_LOADING : allDone ? TASKS_ALL_DONE : TASKS_PROGRESS_HINT}
          </Text>
        </View>

        {loading && list.length === 0 ? <LoadingBlock variant="skeleton" message={TASKS_LOADING} /> : null}

        {allDone ? (
          <GlassCard glow className="w-full p-5" innerClassName="flex-row items-center gap-3">
            <Icon name="auto_awesome" size={24} color={colors.primary} />
            <Text className="flex-1 font-body-medium text-[15px] leading-6 text-on-surface">
              Beautiful consistency. Rest easy — tomorrow’s rituals will be waiting.
            </Text>
          </GlassCard>
        ) : null}

        <View className="w-full gap-3" style={{ flexGrow: 0 }}>
          {list.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              completed={completedIds.includes(task.id)}
              onToggle={() => markComplete(task.id)}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
            />
          ))}
        </View>
      </MainTabScroll>
    </CosmicScreen>
  );
}

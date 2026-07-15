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
import { TASKS_EMPTY_NO_PALM } from '@/constants/userCopy';
import { fetchDailyTasks } from '@/services/agastyaApi';
import { scheduleDailyTaskReminder, cancelDailyTaskReminder } from '@/services/notifications';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { isTabRoute } from '@/utils/isTabRoute';
import { LOCAL_TASKS, normalizeTask } from '@/utils/localTasks';
import { withApiRetry } from '@/utils/apiRetry';

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
  const setTasks = useTaskStore((s) => s.setTasks);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);

  const [loading, setLoading] = useState(false);

  const isoToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const list = tasks.length ? tasks : LOCAL_TASKS;
  const doneCount = list.filter((t) => completedIds.includes(t.id)).length;
  const allDone = doneCount === list.length && list.length > 0;

  useEffect(() => {
    if (!isTabRoute(pathname, 'tasks')) return;
    let active = true;

    const load = async () => {
      if (!palmAnalysis) return;

      if (!sessionId) {
        if (tasks.length === 0 || taskDate !== isoToday) {
          setTasks(LOCAL_TASKS, 'fallback', isoToday);
        }
        return;
      }

      if (tasks.length && taskDate === isoToday) return;
      setLoading(true);
      try {
        const payload = await withApiRetry(() => fetchDailyTasks({ sessionId, palmAnalysis }));
        if (active) {
          const normalized = payload.tasks.map((t, i) => normalizeTask(t, i));
          setTasks(normalized.length ? normalized : LOCAL_TASKS, payload.variant, isoToday);
        }
      } catch {
        if (active) {
          setTasks(LOCAL_TASKS, 'fallback', isoToday);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [pathname, tasks.length, taskDate, isoToday, palmAnalysis, premium, sessionId, setTasks]);

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
        title="Daily tasks are a Pro feature"
        body="Unlock full access for personalized daily guidance tied to your palm reading."
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

        <PageTitle title="Today’s Rituals" subtitle={formatToday()} />

        <View className="items-center overflow-visible py-4" style={{ minHeight: 168 }}>
          <ProgressRing done={doneCount} total={list.length} />
          <Text className="mt-4 font-body text-[14px] text-on-surface-variant">
            {loading
              ? 'Loading your tasks…'
              : allDone
                ? 'All rituals complete'
                : 'Use the checkbox on each task to mark it done.'}
          </Text>
        </View>

        {loading && list.length === 0 ? <LoadingBlock variant="skeleton" message="Preparing today’s rituals…" /> : null}

        {allDone ? (
          <GlassCard glow className="w-full p-5" innerClassName="flex-row items-center gap-3">
            <Icon name="auto_awesome" size={24} color={colors.primary} />
            <Text className="flex-1 font-body-medium text-[15px] leading-6 text-on-surface">
              Nice work today. Come back tomorrow for your next rituals.
            </Text>
          </GlassCard>
        ) : null}

        <View className="w-full gap-3">
          {list.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              completed={completedIds.includes(task.id)}
              onToggle={() => toggleComplete(task.id)}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
            />
          ))}
        </View>
      </MainTabScroll>
    </CosmicScreen>
  );
}

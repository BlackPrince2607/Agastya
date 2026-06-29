import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { EmptyState, InlineError, PageTitle } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { ProgressRing } from '@/components/tasks/ProgressRing';
import { TaskCard } from '@/components/tasks/TaskCard';
import { GlassCard, Icon } from '@/components/ui';
import { TASKS_EMPTY_NO_PALM, TASKS_FALLBACK_NOTICE } from '@/constants/userCopy';
import { fetchDailyTasks } from '@/services/agastyaApi';
import { scheduleDailyTaskReminder, cancelDailyTaskReminder } from '@/services/notifications';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { isTabRoute } from '@/utils/isTabRoute';
import { LOCAL_TASKS, normalizeTask } from '@/utils/localTasks';

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
  const variant = useTaskStore((s) => s.variant);
  const setTasks = useTaskStore((s) => s.setTasks);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isoToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const list = tasks.length ? tasks : LOCAL_TASKS;
  const doneCount = list.filter((t) => completedIds.includes(t.id)).length;
  const allDone = doneCount === list.length && list.length > 0;

  useEffect(() => {
    if (!isTabRoute(pathname, 'tasks')) return;
    let active = true;

    const load = async () => {
      if (!sessionId || !palmAnalysis) return;
      if (tasks.length && taskDate === isoToday) return;
      setLoading(true);
      setLoadError(null);
      try {
        const payload = await fetchDailyTasks({ sessionId, palmAnalysis });
        if (active) {
          const normalized = payload.tasks.map((t, i) => normalizeTask(t, i));
          setTasks(normalized.length ? normalized : LOCAL_TASKS, payload.variant, isoToday);
        }
      } catch {
        if (active) {
          setTasks(LOCAL_TASKS, 'fallback', isoToday);
          setLoadError(TASKS_FALLBACK_NOTICE);
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

        <PageTitle title="Today’s Tasks" subtitle={formatToday()} />

        {loadError ? <InlineError message={loadError} onDismiss={() => setLoadError(null)} /> : null}

        <View className="items-center py-3">
          <ProgressRing done={doneCount} total={list.length} />
          <Text className="mt-3 font-body text-[14px] text-on-surface-variant">
            {loading ? 'Loading your rituals…' : allDone ? 'All rituals complete ✦' : 'Tap a task when you complete it.'}
          </Text>
        </View>

        {allDone ? (
          <GlassCard glow className="w-full flex-row items-center gap-3 p-4">
            <Icon name="auto_awesome" size={24} color="#d3beeb" />
            <Text className="flex-1 font-body-medium text-[15px] text-on-surface">
              Beautiful work today. Great things are unfolding—come back tomorrow.
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

        {variant === 'fallback' && !loadError ? (
          <Text className="text-center font-body text-[12px] text-on-surface-variant">{TASKS_FALLBACK_NOTICE}</Text>
        ) : null}
      </MainTabScroll>
    </CosmicScreen>
  );
}

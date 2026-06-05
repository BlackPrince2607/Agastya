import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState, InlineError, LoadingBlock, SectionHeader } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { CosmicButton, GlowCard, MetricDonut } from '@/components/primitives';
import {
  FALLBACK_DAILY_TASKS,
  TASKS_EMPTY_NO_PALM,
  TASKS_FALLBACK_NOTICE,
} from '@/constants/userCopy';
import { fetchDailyTasks } from '@/services/agastyaApi';
import { useSessionStore } from '@/store/sessionStore';

export default function TasksScreen() {
  const pathname = usePathname();
  const displayName = useSessionStore((s) => s.userDisplayName);
  const sessionId = useSessionStore((s) => s.sessionId);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const dailyTasks = useSessionStore((s) => s.dailyTasks);
  const dailyTasksDate = useSessionStore((s) => s.dailyTasksDate);
  const dailyTasksVariant = useSessionStore((s) => s.dailyTasksVariant);
  const setDailyTasks = useSessionStore((s) => s.setDailyTasks);

  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isoToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tasks = dailyTasks.length ? dailyTasks : FALLBACK_DAILY_TASKS;
  const doneCount = completed.size;
  const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  useEffect(() => {
    if (pathname !== '/tasks') return;
    let active = true;

    const load = async () => {
      if (!sessionId || !palmAnalysis) return;
      if (dailyTasks.length && dailyTasksDate === isoToday) {
        setUsingFallback(dailyTasksVariant === 'fallback');
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const payload = await fetchDailyTasks({ sessionId, palmAnalysis, isPremium: premium });
        if (active) {
          setDailyTasks(payload.tasks, payload.variant, isoToday);
          setUsingFallback(false);
        }
      } catch {
        if (active) {
          setDailyTasks(FALLBACK_DAILY_TASKS, 'fallback', isoToday);
          setUsingFallback(true);
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
  }, [
    pathname,
    dailyTasks.length,
    dailyTasksDate,
    dailyTasksVariant,
    isoToday,
    palmAnalysis,
    premium,
    sessionId,
    setDailyTasks,
  ]);

  const toggle = (index: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!palmAnalysis) {
    return (
      <CosmicScreen variant="stitch">
        <MainTabScroll>
          <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />
          <EmptyState
            icon="check-circle-o"
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
        <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />

        <SectionHeader title="Today" subtitle="Small actions that add up" />

        {loadError ? <InlineError message={loadError} onDismiss={() => setLoadError(null)} /> : null}

        <GlowCard className="flex-row items-center gap-5">
          <View className="items-center">
            <MetricDonut label="daily" value={progressPct} size={92} />
            <Text className="mt-1 text-[12px] text-md-on-surface-variant">
              {doneCount}/{tasks.length} done
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-inter-medium text-[18px] text-mist">Your list</Text>
            <Text className="mt-1 text-[14px] leading-5 text-md-on-surface-variant">
              {loading ? 'Loading your tasks…' : 'Tap a task when you complete it.'}
            </Text>
          </View>
        </GlowCard>

        {loading ? <LoadingBlock compact message="Loading your tasks…" /> : null}

        {usingFallback && !loadError ? (
          <Text className="text-[13px] text-md-on-surface-variant">{TASKS_FALLBACK_NOTICE}</Text>
        ) : null}

        <View className="w-full gap-3">
          {tasks.map((task, i) => {
            const done = completed.has(i);
            return (
              <Pressable
                key={`${task}-${i}`}
                onPress={() => toggle(i)}
                className="active:opacity-90"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={task}>
                <GlowCard muted className={`flex-row items-center gap-3 py-4 ${done ? 'opacity-55' : ''}`}>
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full border ${
                      done ? 'border-stitch-signal/50 bg-stitch-signal/20' : 'border-white/15'
                    }`}>
                    <Text className="text-[13px] text-mist">{done ? '✓' : i + 1}</Text>
                  </View>
                  <Text
                    className={`flex-1 text-[15px] leading-6 text-mist ${done ? 'line-through text-md-on-surface-variant' : ''}`}>
                    {task}
                  </Text>
                </GlowCard>
              </Pressable>
            );
          })}
        </View>

        {doneCount < tasks.length ? (
          <CosmicButton
            gradient="nebulaMd3"
            label="Mark next complete"
            onPress={() => {
              const next = tasks.findIndex((_, i) => !completed.has(i));
              if (next >= 0) toggle(next);
            }}
          />
        ) : (
          <Text className="text-center font-inter text-[14px] text-stitch-signal">You&apos;re done for today</Text>
        )}
      </MainTabScroll>
    </CosmicScreen>
  );
}

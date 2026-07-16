import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AnalyticsEvent, track, trackOnce } from '@/services/analytics';
import { persistentStorage } from '@/services/persistentStorage';
import type { Task } from '@/types/task';

type TaskStore = {
  tasks: Task[];
  completedIds: string[];
  /** ISO date (yyyy-mm-dd) the current tasks belong to. */
  taskDate: string | null;
  variant: string | null;
  /** Today's Focus theme from the rituals API (career|love|money|growth). */
  focusTheme: string | null;
  streak: number;
  /** isoDate -> completed task ids (for streak history). */
  history: Record<string, string[]>;

  setTasks: (tasks: Task[], variant: string | null, isoDate: string, focusTheme?: string | null) => void;
  setFocusTheme: (focusTheme: string | null) => void;
  toggleComplete: (id: string) => void;
  isComplete: (id: string) => boolean;
};

function isYesterday(prev: string, today: string): boolean {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10) === prev;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      completedIds: [],
      taskDate: null,
      variant: null,
      focusTheme: null,
      streak: 0,
      history: {},

      setTasks: (tasks, variant, isoDate, focusTheme = null) => {
        const prev = get().taskDate;
        // New day → reset completion for the fresh list.
        const sameDay = prev === isoDate;
        set({
          tasks,
          variant,
          focusTheme: focusTheme ?? null,
          taskDate: isoDate,
          completedIds: sameDay ? get().completedIds : [],
        });
      },

      setFocusTheme: (focusTheme) => {
        if (get().focusTheme === focusTheme) return;
        set({ focusTheme });
      },

      toggleComplete: (id) => {
        const { completedIds, tasks, taskDate, history, streak } = get();
        const activeCount = tasks.length;
        const has = completedIds.includes(id);
        const nextCompleted = has ? completedIds.filter((c) => c !== id) : [...completedIds, id];

        let nextStreak = streak;
        let nextHistory = history;
        if (taskDate && !has && activeCount > 0 && nextCompleted.length === activeCount) {
          // All tasks done for the day → record + bump streak.
          if (!history[taskDate]) {
            const dates = Object.keys(history).sort();
            const last = dates[dates.length - 1];
            nextStreak = last && isYesterday(last, taskDate) ? streak + 1 : Math.max(1, streak === 0 ? 1 : streak + 1);
            if (!last) nextStreak = 1;
          }
          nextHistory = { ...history, [taskDate]: nextCompleted };
        }

        set({ completedIds: nextCompleted, streak: nextStreak, history: nextHistory });

        if (!has) {
          track(AnalyticsEvent.RITUAL_COMPLETED, {
            task_id: id,
            is_reflection: id === 'evening-reflection',
          });
          if (taskDate && activeCount > 0 && nextCompleted.length === activeCount) {
            trackOnce(`all_rituals_completed:${taskDate}`, AnalyticsEvent.ALL_RITUALS_COMPLETED, {
              date: taskDate,
              ritual_count: activeCount,
            });
          }
        }
      },

      isComplete: (id) => get().completedIds.includes(id),
    }),
    {
      name: 'agastya-tasks-v1',
      storage: createJSONStorage(() => persistentStorage),
    },
  ),
);

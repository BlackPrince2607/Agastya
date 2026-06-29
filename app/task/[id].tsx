import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { PAGE_PADDING } from '@/constants/layout';
import { GlassCard, Icon, NebulaButton } from '@/components/ui';
import { useTaskStore } from '@/store/taskStore';
import { LOCAL_TASKS } from '@/utils/localTasks';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Gentle',
  medium: 'Bold',
  hard: 'Brave',
};

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tasks = useTaskStore((s) => s.tasks);
  const completedIds = useTaskStore((s) => s.completedIds);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);

  const pool = tasks.length ? tasks : LOCAL_TASKS;
  const task = id ? pool.find((t) => t.id === id) : undefined;
  const completed = task ? completedIds.includes(task.id) : false;

  useEffect(() => {
    if (!task) router.back();
  }, [task]);

  if (!task) {
    return null;
  }

  return (
    <CosmicScreen>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 py-3" style={{ paddingHorizontal: PAGE_PADDING }}>
          <BackButton />
          <Text className="font-label text-[12px] uppercase tracking-[0.16em] text-on-surface-variant">
            {DIFFICULTY_LABEL[task.difficulty] ?? 'Daily'} · {task.estimatedMinutes} min
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAGE_PADDING, paddingBottom: insets.bottom + 96, gap: 20 }}>
          <View className="mt-2 gap-3">
            <Text className="font-headline text-[34px] leading-[40px] text-on-surface">{task.text}</Text>
            <Text className="font-body text-[16px] leading-7 text-on-surface-variant">{task.description}</Text>
          </View>

          {task.examples.length > 0 ? (
            <GlassCard className="w-full gap-3 p-5">
              <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-primary">Try one of these</Text>
              {task.examples.map((ex) => (
                <View key={ex} className="flex-row items-center gap-3">
                  <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <Text className="flex-1 font-body text-[15px] text-on-surface">{ex}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 pt-4"
          style={{ paddingHorizontal: PAGE_PADDING, paddingBottom: Math.max(insets.bottom, 16) }}>
          <NebulaButton
            label={completed ? 'Completed ✦' : 'Mark as Complete'}
            variant={completed ? 'ghost' : 'nebula'}
            onPress={() => {
              toggleComplete(task.id);
              if (!completed) router.back();
            }}
          />
        </View>
      </View>
    </CosmicScreen>
  );
}

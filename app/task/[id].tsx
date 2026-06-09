import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
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
  const task = pool.find((t) => t.id === id) ?? pool[0];
  const completed = task ? completedIds.includes(task.id) : false;

  if (!task) {
    router.back();
    return null;
  }

  return (
    <CosmicScreen>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 px-6 py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-80">
            <Icon name="chevron_left" size={24} color="#22d3ee" />
          </Pressable>
          <Text className="font-label text-[12px] uppercase tracking-[0.16em] text-on-surface-variant">
            {DIFFICULTY_LABEL[task.difficulty] ?? 'Daily'} · {task.estimatedMinutes} min
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 120, gap: 20 }}>
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
          className="absolute bottom-0 left-0 right-0 px-6 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
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

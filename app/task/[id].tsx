import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/feedback';
import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_SINGLE } from '@/components/layout/StickyActionBar';
import { PAGE_PADDING } from '@/constants/layout';
import {
  REFLECTION_COMPLETE,
  REFLECTION_COMPLETED,
  TASK_DETAIL_COMPLETE,
  TASK_DETAIL_COMPLETED,
  TASK_DETAIL_MISSING,
} from '@/constants/userCopy';
import { GlassCard, PrimaryButton } from '@/components/ui';
import { submitDailyReflection } from '@/services/agastyaApi';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { goBack } from '@/utils/navigationBack';
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
  const sessionId = useSessionStore((s) => s.sessionId);

  const pool = tasks.length ? tasks : LOCAL_TASKS;
  const task = id ? pool.find((t) => t.id === id) : undefined;
  const completed = task ? completedIds.includes(task.id) : false;
  const isReflection = task?.id === 'evening-reflection';

  if (!task) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center gap-3 py-3" style={{ paddingHorizontal: PAGE_PADDING }}>
            <BackButton />
          </View>
          <EmptyState
            icon="task_alt"
            title={TASK_DETAIL_MISSING.title}
            body={TASK_DETAIL_MISSING.body}
            actionLabel={TASK_DETAIL_MISSING.action}
            onAction={() => router.replace('/tasks')}
          />
        </View>
      </CosmicScreen>
    );
  }

  const completeLabel = isReflection
    ? completed
      ? REFLECTION_COMPLETED
      : REFLECTION_COMPLETE
    : completed
      ? TASK_DETAIL_COMPLETED
      : TASK_DETAIL_COMPLETE;

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
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING,
            paddingBottom: insets.bottom + STICKY_ACTION_BAR_SINGLE,
            gap: 20,
          }}>
          <View className="mt-2 gap-3">
            <Text className="font-headline text-[34px] leading-[40px] text-on-surface">{task.text}</Text>
            <Text className="font-body text-[16px] leading-7 text-on-surface-variant">{task.description}</Text>
          </View>

          {task.examples.length > 0 ? (
            <GlassCard className="w-full gap-3 p-5">
              <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-primary">
                {isReflection ? 'A few prompts' : 'Try one of these'}
              </Text>
              {task.examples.map((ex) => (
                <View key={ex} className="flex-row items-center gap-3">
                  <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <Text className="flex-1 font-body text-[15px] text-on-surface">{ex}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}
        </ScrollView>

        <StickyActionBar>
          <PrimaryButton
            label={completeLabel}
            variant={completed ? 'ghost' : 'primary'}
            onPress={() => {
              const completing = !completed;
              toggleComplete(task.id);
              if (completing && isReflection && sessionId) {
                void submitDailyReflection({ sessionId }).catch(() => undefined);
              }
              if (!completed) goBack({ pathname: `/task/${task.id}` });
            }}
          />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

import { Pressable, Text, View } from 'react-native';

import { GlassCard, Icon } from '@/components/ui';
import type { Task } from '@/types/task';

type TaskCardProps = {
  task: Task;
  completed: boolean;
  onToggle: () => void;
  onPress: () => void;
};

export function TaskCard({ task, completed, onToggle, onPress }: TaskCardProps) {
  return (
    <GlassCard muted className={`p-4 ${completed ? 'opacity-70' : ''}`} innerClassName="flex-row items-center gap-3">
      <Pressable
        onPress={onToggle}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`Mark ${task.text} ${completed ? 'incomplete' : 'complete'}`}
        className={`h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          completed ? 'border-transparent' : 'border-white/25'
        }`}
        style={completed ? { backgroundColor: 'rgba(74,222,128,0.22)' } : undefined}>
        {completed ? <Icon name="check" size={18} color="#4ade80" /> : null}
      </Pressable>

      <Pressable
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-2 active:opacity-90"
        accessibilityRole="button"
        accessibilityLabel={`Open ${task.text}`}>
        <View className="min-w-0 flex-1">
          <Text
            className="font-body-medium text-[16px] text-on-surface"
            style={completed ? { textDecorationLine: 'line-through', opacity: 0.75 } : undefined}>
            {task.text}
          </Text>
          {task.description ? (
            <Text className="mt-0.5 font-body text-[13px] leading-5 text-on-surface-variant">{task.description}</Text>
          ) : null}
        </View>
        <Icon name="chevron_right" size={20} color="rgba(203,196,206,0.6)" />
      </Pressable>
    </GlassCard>
  );
}

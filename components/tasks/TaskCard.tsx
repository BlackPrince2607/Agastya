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
    <Pressable onPress={onPress} className="active:opacity-90" accessibilityRole="button" accessibilityLabel={task.text}>
      <GlassCard muted className={`flex-row items-center gap-3 p-4 ${completed ? 'opacity-60' : ''}`}>
        <Pressable
          onPress={onToggle}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
          accessibilityLabel={`Mark ${task.text} ${completed ? 'incomplete' : 'complete'}`}
          className={`h-8 w-8 items-center justify-center rounded-full border ${
            completed ? 'border-transparent bg-growth/25' : 'border-white/25'
          }`}
          style={completed ? { backgroundColor: 'rgba(74,222,128,0.2)' } : undefined}>
          {completed ? <Icon name="check" size={18} color="#4ade80" /> : null}
        </Pressable>

        <View className="flex-1">
          <Text
            className="font-body-medium text-[16px] text-on-surface"
            style={completed ? { textDecorationLine: 'line-through', opacity: 0.7 } : undefined}>
            {task.text}
          </Text>
          {task.description ? (
            <Text className="mt-0.5 font-body text-[13px] leading-5 text-on-surface-variant" numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
        </View>

        <Icon name="chevron_right" size={20} color="rgba(203,196,206,0.6)" />
      </GlassCard>
    </Pressable>
  );
}

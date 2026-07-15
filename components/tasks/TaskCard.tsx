import { Pressable, Text, View } from 'react-native';

import { GlassCard, Icon } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors } from '@/constants/theme';
import { triggerLightTap } from '@/hooks/useHapticTap';
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
        onPress={() => {
          void triggerLightTap();
          onToggle();
        }}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`Mark ${task.text} ${completed ? 'incomplete' : 'complete'}`}
        className={`h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
          completed ? 'border-transparent' : 'border-white/25'
        }`}
        style={completed ? { backgroundColor: 'rgba(134,239,172,0.22)' } : undefined}>
        {completed ? <Icon name="check" size={18} color={colors.health} /> : null}
      </Pressable>

      <PressableScale
        onPress={onPress}
        scaleTo={0.99}
        accessibilityLabel={`Open ${task.text}`}
        style={{ flex: 1, minWidth: 0 }}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
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
        </View>
      </PressableScale>
    </GlassCard>
  );
}

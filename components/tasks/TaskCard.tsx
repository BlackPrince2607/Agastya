import { Pressable, Text, View } from 'react-native';

import { GlassCard, Icon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { Task } from '@/types/task';

type TaskCardProps = {
  task: Task;
  completed: boolean;
  onToggle: () => void;
  onPress: () => void;
};

/** Compact daily-ritual row — height wraps content (no Moti flex stretch). */
export function TaskCard({ task, completed, onToggle, onPress }: TaskCardProps) {
  const title = task.text.trim() || 'Daily ritual';
  const description = task.description.trim();

  return (
    <GlassCard
      muted
      className={completed ? 'opacity-70' : undefined}
      style={{ alignSelf: 'stretch', flexGrow: 0 }}
      innerClassName="flex-row items-center gap-3 px-4 py-3.5">
      <Pressable
        onPress={() => {
          void triggerLightTap();
          onToggle();
        }}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`Mark ${title} ${completed ? 'incomplete' : 'complete'}`}
        className={`h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
          completed ? 'border-transparent' : 'border-white/25'
        }`}
        style={completed ? { backgroundColor: 'rgba(134,239,172,0.22)' } : undefined}>
        {completed ? <Icon name="check" size={18} color={colors.health} /> : null}
      </Pressable>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        style={{ flex: 1, minWidth: 0, flexGrow: 1, flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={2}
              className="font-body-medium text-[16px]"
              style={{
                color: colors.onSurface,
                textDecorationLine: completed ? 'line-through' : 'none',
                opacity: completed ? 0.75 : 1,
              }}>
              {title}
            </Text>
            {description ? (
              <Text
                numberOfLines={2}
                className="mt-0.5 font-body text-[13px] leading-5"
                style={{ color: colors.onSurfaceVariant }}>
                {description}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron_right" size={20} color="rgba(203,196,206,0.6)" />
        </View>
      </Pressable>
    </GlassCard>
  );
}

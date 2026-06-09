import { MotiView } from 'moti';
import { ActivityIndicator, Text, View } from 'react-native';

import { Icon } from '@/components/ui';

export type ChecklistItem = {
  label: string;
  /** done = checked, active = spinner, pending = dimmed */
  state: 'done' | 'active' | 'pending';
};

/** Stitch "AI is reading your:" animated checklist. */
export function ReadingChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <View className="gap-3">
      {items.map((item, idx) => (
        <MotiView
          key={item.label}
          from={{ opacity: 0, translateY: 6 }}
          animate={{ opacity: item.state === 'pending' ? 0.45 : 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320, delay: idx * 120 }}
          className="flex-row items-center gap-3">
          <View className="h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
            {item.state === 'done' ? (
              <Icon name="check" size={16} color="#4ade80" />
            ) : item.state === 'active' ? (
              <ActivityIndicator size="small" color="#22d3ee" />
            ) : (
              <Icon name="radio_button_unchecked" size={14} color="rgba(232,225,229,0.4)" />
            )}
          </View>
          <Text
            className="font-body text-[15px] text-on-surface"
            style={{ opacity: item.state === 'pending' ? 0.6 : 1 }}>
            {item.label}
          </Text>
        </MotiView>
      ))}
    </View>
  );
}

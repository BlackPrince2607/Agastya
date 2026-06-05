import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View } from 'react-native';

import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import type { HomeShortcut, HomeShortcutAction } from '@/constants/userCopy';

type QuickAccessGridProps = {
  items: HomeShortcut[];
  premium: boolean;
  onPress: (action: HomeShortcutAction) => void;
};

export function QuickAccessGrid({ items, premium, onPress }: QuickAccessGridProps) {
  const { gridGap, tileMinHeight } = useLayoutMetrics();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap, justifyContent: 'space-between' }}>
      {items.map((item) => {
        const label = item.action === 'paywall' && premium ? 'Report' : item.label;
        return (
          <Pressable
            key={item.action}
            onPress={() => onPress(item.action)}
            style={{ width: '48%', minHeight: tileMinHeight }}
            className="active:opacity-90"
            accessibilityRole="button"
            accessibilityLabel={`${label}. ${item.hint}`}>
            <View className="h-full items-center justify-center rounded-3xl border border-white/12 bg-white/[0.06] px-3 py-4">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-stitch-violet/20">
                <FontAwesome name={item.icon} size={20} color="#d392f6" />
              </View>
              <Text className="mt-3 text-center font-inter-medium text-[14px] text-mist">{label}</Text>
              {item.hint ? (
                <Text className="mt-1 text-center text-[11px] leading-4 text-md-on-surface-variant">{item.hint}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

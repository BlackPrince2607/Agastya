import { Pressable, Text, View } from 'react-native';

import type { PalmScanHand } from '@/store/sessionStore';

type HandToggleProps = {
  hand: PalmScanHand | null;
  onSelect: (hand: PalmScanHand) => void;
};

function ToggleOption({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="min-w-0 flex-1" accessibilityRole="button" accessibilityState={{ selected }}>
      <View
        className={
          selected
            ? 'min-h-[58px] justify-center rounded-full border border-stitch-magenta bg-stitch-magenta/15 px-3 py-2.5 shadow-glow'
            : 'min-h-[58px] justify-center rounded-full border border-white/15 bg-black/45 px-3 py-2.5'
        }>
        <Text className="text-center font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.12em] text-mist" numberOfLines={1}>
          {label}
        </Text>
        <Text className="mt-0.5 text-center font-inter text-[10px] leading-4 text-md-on-surface-variant" numberOfLines={2}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

/** Left / right hand picker — fixed height prevents layout shift when switching. */
export function HandToggleRow({ hand, onSelect }: HandToggleProps) {
  const resolved = hand ?? 'right';

  return (
    <View className="w-full flex-row gap-3">
      <ToggleOption
        label="Left hand"
        sub="Receptive energy"
        selected={resolved === 'left'}
        onPress={() => onSelect('left')}
      />
      <ToggleOption
        label="Right hand"
        sub="Active energy"
        selected={resolved === 'right'}
        onPress={() => onSelect('right')}
      />
    </View>
  );
}

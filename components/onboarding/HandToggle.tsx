import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PalmScanHand } from '@/store/sessionStore';

type HandToggleProps = {
  hand: PalmScanHand | null;
  onSelect: (hand: PalmScanHand) => void;
  /** Shorter chips for camera dock. */
  compact?: boolean;
};

const CHIP = {
  magenta: '#e879f9',
  magentaBg: 'rgba(232,121,249,0.15)',
  borderIdle: 'rgba(255,255,255,0.15)',
  bgIdle: 'rgba(0,0,0,0.45)',
  mist: '#e6e1e5',
  subtext: '#cbc4ce',
} as const;

function ToggleOption({
  label,
  sub,
  selected,
  onPress,
  compact,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View
        style={[
          styles.chip,
          compact ? styles.chipCompact : styles.chipRegular,
          selected ? styles.chipSelected : styles.chipIdle,
        ]}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {!compact && sub ? (
          <Text style={styles.sub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Left / right hand picker — static styles avoid NativeWind dynamic className crashes. */
export function HandToggleRow({ hand, onSelect, compact }: HandToggleProps) {
  const resolved = hand ?? 'right';

  return (
    <View style={styles.row}>
      <ToggleOption
        label={compact ? 'Left' : 'Left hand'}
        sub="Traditional for women"
        selected={resolved === 'left'}
        onPress={() => onSelect('left')}
        compact={compact}
      />
      <ToggleOption
        label={compact ? 'Right' : 'Right hand'}
        sub="Traditional for men"
        selected={resolved === 'right'}
        onPress={() => onSelect('right')}
        compact={compact}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  pressable: {
    minWidth: 0,
    flex: 1,
  },
  chip: {
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  chipCompact: {
    minHeight: 44,
    paddingVertical: 8,
  },
  chipRegular: {
    minHeight: 58,
    paddingVertical: 10,
  },
  chipIdle: {
    borderColor: CHIP.borderIdle,
    backgroundColor: CHIP.bgIdle,
  },
  chipSelected: {
    borderColor: CHIP.magenta,
    backgroundColor: CHIP.magentaBg,
    shadowColor: CHIP.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: CHIP.mist,
  },
  sub: {
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 16,
    color: CHIP.subtext,
  },
});

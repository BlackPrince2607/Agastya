import { Pressable, Text } from 'react-native';

type AuraChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Accent tint for the resting state (hex). Defaults to primary lavender. */
  tint?: string;
};

/**
 * Stitch "Aura Chip" — fully rounded pill with low-opacity accent fill.
 * Used for traits, suggestions, and filter pills.
 */
export function AuraChip({ label, selected, onPress, tint = '#d3beeb' }: AuraChipProps) {
  const body = (
    <Text
      className="font-label uppercase tracking-[0.08em]"
      style={{ color: selected ? '#0f0e10' : tint }}>
      {label}
    </Text>
  );

  const base =
    'self-start rounded-pill border px-4 py-2 ' +
    (selected ? 'border-transparent' : 'border-white/15 bg-white/[0.05]');

  if (!onPress) {
    return (
      <Pressable disabled className={base} style={selected ? { backgroundColor: tint } : undefined}>
        {body}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`${base} active:opacity-80`}
      style={selected ? { backgroundColor: tint } : undefined}>
      {body}
    </Pressable>
  );
}

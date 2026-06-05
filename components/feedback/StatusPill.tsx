import { Text, View } from 'react-native';

export type StatusPillVariant = 'offline' | 'premium' | 'info';

const VARIANT_STYLES: Record<StatusPillVariant, { bg: string; text: string }> = {
  offline: { bg: 'bg-amber-500/15 border-amber-400/30', text: 'text-amber-100' },
  premium: { bg: 'bg-stitch-violet/20 border-stitch-violet/35', text: 'text-stitch-signal' },
  info: { bg: 'bg-white/[0.06] border-white/12', text: 'text-md-on-surface-variant' },
};

type StatusPillProps = {
  label: string;
  variant?: StatusPillVariant;
};

export function StatusPill({ label, variant = 'info' }: StatusPillProps) {
  const style = VARIANT_STYLES[variant];
  return (
    <View className={`self-start rounded-full border px-3 py-1.5 ${style.bg}`}>
      <Text className={`font-inter text-[12px] ${style.text}`}>{label}</Text>
    </View>
  );
}

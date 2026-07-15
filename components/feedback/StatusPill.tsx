import { Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export type StatusPillVariant = 'offline' | 'premium' | 'info';

const VARIANT_STYLES: Record<
  StatusPillVariant,
  { border: string; background: string; text: string }
> = {
  offline: {
    border: 'rgba(251,191,36,0.35)',
    background: 'rgba(251,191,36,0.12)',
    text: '#fde68a',
  },
  premium: {
    border: colors.successBorder,
    background: colors.successMuted,
    text: colors.cyan,
  },
  info: {
    border: 'rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    text: colors.onSurfaceVariant,
  },
};

type StatusPillProps = {
  label: string;
  variant?: StatusPillVariant;
};

export function StatusPill({ label, variant = 'info' }: StatusPillProps) {
  const style = VARIANT_STYLES[variant];
  return (
    <View
      className="self-start rounded-full border px-3 py-1.5"
      style={{ borderColor: style.border, backgroundColor: style.background }}
      accessibilityRole="text"
      accessibilityLabel={label}>
      <Text className="font-label text-[11px] uppercase tracking-[0.14em]" style={{ color: style.text }} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
}

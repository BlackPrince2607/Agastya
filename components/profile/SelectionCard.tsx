import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { Icon, PressableScale, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';

type SelectionCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Leading icon glyph (Material Symbols via Icon). */
  icon?: IconName;
  /** Custom leading node instead of icon. */
  leading?: ReactNode;
  /** Single-select (radio) vs multi-select (check). */
  indicator?: 'radio' | 'check';
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Premium selectable row/card — soft glass, glow only when selected.
 */
export function SelectionCard({
  title,
  description,
  selected,
  onPress,
  icon,
  leading,
  indicator = 'check',
  accessibilityLabel,
  accessibilityHint,
}: SelectionCardProps) {
  const indicatorIcon: IconName =
    indicator === 'radio'
      ? selected
        ? 'check_circle'
        : 'radio_button_unchecked'
      : selected
        ? 'check_circle'
        : 'radio_button_unchecked';

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={{ width: '100%' }}>
      <MotiView
        animate={{
          scale: selected ? 1.01 : 1,
          borderColor: selected ? 'rgba(168,85,247,0.55)' : 'rgba(255,255,255,0.08)',
          backgroundColor: selected ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.04)',
        }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minHeight: 72,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 20,
          borderWidth: 1,
          ...(selected
            ? {
                shadowColor: colors.purple,
                shadowOpacity: 0.32,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              }
            : {
                shadowOpacity: 0,
                elevation: 0,
              }),
        }}>
        {leading ??
          (icon ? (
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: selected ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.06)',
                borderColor: selected ? 'rgba(211,190,235,0.35)' : 'rgba(255,255,255,0.1)',
              }}>
              <Icon name={icon} size={22} color={selected ? colors.primary : colors.onSurfaceVariant} />
            </View>
          ) : null)}

        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            className="font-body-medium text-[16px] leading-6 text-on-surface"
            maxFontSizeMultiplier={1.35}>
            {title}
          </Text>
          {description ? (
            <Text
              className="font-body text-[13px] leading-5 text-on-surface-variant"
              maxFontSizeMultiplier={1.4}>
              {description}
            </Text>
          ) : null}
        </View>

        <MotiView
          animate={{ scale: selected ? 1 : 0.92, opacity: selected ? 1 : 0.45 }}
          transition={{ type: 'spring', damping: 16, stiffness: 260 }}>
          <Icon
            name={indicatorIcon}
            size={22}
            color={selected ? colors.primary : 'rgba(203,196,206,0.45)'}
          />
        </MotiView>
      </MotiView>
    </PressableScale>
  );
}

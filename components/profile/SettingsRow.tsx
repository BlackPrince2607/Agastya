import { memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon, PressableScale, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';

export const SETTINGS_ROW_HEIGHT = 60;

export type SettingsRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  tint?: string;
  last?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  badge?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
};

function SettingsRowComponent({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tint,
  last,
  destructive,
  disabled,
  badge,
  trailing,
  showChevron = true,
}: SettingsRowProps) {
  const chevron = showChevron && Boolean(onPress) && !trailing && !disabled;

  const content = (
    <View
      className={`flex-row items-center gap-3 ${last ? '' : 'border-b border-white/[0.06]'}`}
      style={{ minHeight: SETTINGS_ROW_HEIGHT, paddingVertical: 10 }}>
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: destructive ? colors.errorMuted : 'rgba(168,85,247,0.12)',
        }}>
        <Icon name={icon} size={18} color={tint ?? (destructive ? colors.error : colors.purple)} />
      </View>

      <View className="min-w-0 flex-1 justify-center gap-0.5">
        <Text
          className={`font-body-medium text-[15px] leading-5 ${destructive ? 'text-error' : 'text-on-surface'}`}
          maxFontSizeMultiplier={1.35}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="font-body text-[12px] leading-4 text-on-surface-variant"
            maxFontSizeMultiplier={1.35}
            numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {badge ? (
        <View
          className="rounded-full border px-2 py-0.5"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            backgroundColor: 'rgba(34,211,238,0.1)',
          }}>
          <Text
            className="font-label text-[9px] uppercase tracking-[0.1em]"
            style={{ color: colors.cyan }}
            maxFontSizeMultiplier={1.2}>
            {badge}
          </Text>
        </View>
      ) : null}

      {trailing}

      {chevron ? <Icon name="chevron_right" size={18} color="rgba(255,255,255,0.32)" /> : null}
    </View>
  );

  if (!onPress || disabled) {
    return (
      <View
        accessibilityRole="text"
        accessibilityState={disabled ? { disabled: true } : undefined}
        accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
        style={disabled ? { opacity: 0.5 } : undefined}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={{ width: '100%' }}>
      {content}
    </PressableScale>
  );
}

export const SettingsRow = memo(SettingsRowComponent);

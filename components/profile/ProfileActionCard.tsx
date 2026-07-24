import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon, PressableScale, type IconName } from '@/components/ui';
import { colors, elevation, gradients } from '@/constants/theme';

const CARD_RADIUS = 20;
const CARD_MIN_HEIGHT = 112;

type ProfileActionCardProps = {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  /** Soft aurora wash + sparkle — use for Share. */
  featured?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Equal-width premium dashboard action card for the Profile hero.
 * Scale + haptic via PressableScale; featured variant adds calm aurora glow.
 */
export function ProfileActionCard({
  title,
  subtitle,
  icon,
  onPress,
  featured = false,
  accessibilityLabel,
  accessibilityHint,
}: ProfileActionCardProps) {
  const iconBg = featured ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.06)';
  const iconBorder = featured ? 'rgba(168,85,247,0.32)' : 'rgba(255,255,255,0.1)';
  const iconColor = featured ? colors.primary : colors.onSurface;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={{ flex: 1, minWidth: 0 }}>
      <View
        className="overflow-hidden border"
        style={[
          {
            minHeight: CARD_MIN_HEIGHT,
            borderRadius: CARD_RADIUS,
            borderColor: featured ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.1)',
            backgroundColor: featured ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.04)',
            paddingHorizontal: 14,
            paddingVertical: 14,
            justifyContent: 'space-between',
          },
          featured ? elevation.card : undefined,
        ]}>
        {featured ? (
          <LinearGradient
            colors={[...gradients.aurora]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : null}

        <View className="relative z-10 flex-row items-start justify-between">
          <View
            className="h-9 w-9 items-center justify-center rounded-2xl border"
            style={{ backgroundColor: iconBg, borderColor: iconBorder }}>
            <Icon name={icon} size={18} color={iconColor} />
          </View>
          {featured ? (
            <Icon name="auto_awesome" size={12} color="rgba(211,190,235,0.55)" />
          ) : null}
        </View>

        <View className="relative z-10 mt-3 gap-0.5">
          <Text
            className="font-body-medium text-[14px] leading-5 text-on-surface"
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}>
            {title}
          </Text>
          <Text
            className="font-body text-[11px] leading-4 text-on-surface-variant"
            maxFontSizeMultiplier={1.35}
            numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

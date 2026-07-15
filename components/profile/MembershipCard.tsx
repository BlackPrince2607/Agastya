import { Text, View } from 'react-native';

import { Icon, PressableScale } from '@/components/ui';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors } from '@/constants/theme';

type MembershipCardProps = {
  premium: boolean;
  /** Optional upgrade action when on free plan. */
  onPress?: () => void;
};

/**
 * Single elegant membership indicator — replaces stacked premium pills.
 * Calm muted glass; no glow.
 */
export function MembershipCard({ premium, onPress }: MembershipCardProps) {
  const label = premium ? 'Premium Active' : 'Upgrade to Premium';
  const subtitle = premium
    ? 'Full report, Guide, and compatibility unlocked'
    : 'Unlock your complete spiritual dashboard';

  const body = (
    <GlassCard muted className="w-full px-4 py-3.5" innerClassName="flex-row items-center gap-3.5">
      <View
        className="h-10 w-10 items-center justify-center rounded-2xl border"
        style={{
          backgroundColor: premium ? 'rgba(34,211,238,0.12)' : 'rgba(168,85,247,0.14)',
          borderColor: premium ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.1)',
        }}>
        <Icon
          name={premium ? 'verified_user' : 'auto_awesome'}
          size={20}
          color={premium ? colors.cyan : colors.purple}
        />
      </View>

      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text
            className="font-body-medium text-[15px] leading-5 text-on-surface"
            maxFontSizeMultiplier={1.35}
            numberOfLines={1}>
            {label}
          </Text>
          {premium ? (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: 'rgba(34,211,238,0.14)' }}>
              <Text
                className="font-label text-[9px] uppercase tracking-[0.12em]"
                style={{ color: colors.cyan }}
                maxFontSizeMultiplier={1.2}>
                Pro
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          className="font-body text-[12px] leading-4 text-on-surface-variant"
          maxFontSizeMultiplier={1.35}
          numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {!premium && onPress ? (
        <Icon name="chevron_right" size={18} color="rgba(255,255,255,0.35)" />
      ) : premium ? (
        <Icon name="check_circle" size={18} color={colors.cyan} />
      ) : null}
    </GlassCard>
  );

  if (!onPress || premium) {
    return (
      <View accessibilityRole="text" accessibilityLabel={label}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={label}
      accessibilityHint="Opens premium upgrade"
      style={{ width: '100%' }}>
      {body}
    </PressableScale>
  );
}

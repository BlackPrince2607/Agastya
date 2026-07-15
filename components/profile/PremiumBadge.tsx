import { Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors } from '@/constants/theme';

type PremiumBadgeProps = {
  premium: boolean;
  /** Compact chip vs status line with checkmark. */
  variant?: 'chip' | 'status';
};

/**
 * Membership indicator — soft glass chip or premium-active status.
 */
export function PremiumBadge({ premium, variant = 'chip' }: PremiumBadgeProps) {
  if (variant === 'status') {
    return (
      <View
        className="flex-row items-center gap-1.5 self-start rounded-full border px-3 py-1.5"
        style={{
          borderColor: premium ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.16)',
          backgroundColor: premium ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.06)',
        }}
        accessibilityRole="text"
        accessibilityLabel={premium ? 'Premium Active' : 'Free plan'}>
        {premium ? <Icon name="check_circle" size={14} color={colors.cyan} /> : null}
        <Text
          className="font-label text-[11px] uppercase tracking-[0.16em]"
          style={{ color: premium ? colors.cyan : colors.onSurfaceVariant }}
          maxFontSizeMultiplier={1.3}>
          {premium ? 'Premium Active' : 'Free plan'}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="self-start rounded-full border px-3 py-1.5"
      style={{
        borderColor: premium ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.2)',
        backgroundColor: premium ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.08)',
      }}
      accessibilityRole="text"
      accessibilityLabel={premium ? 'Premium Explorer' : 'Free preview'}>
      <Text
        className="font-label text-[10px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: premium ? colors.cyan : colors.onSurfaceVariant }}
        maxFontSizeMultiplier={1.3}>
        {premium ? 'Premium Explorer' : 'Free preview'}
      </Text>
    </View>
  );
}

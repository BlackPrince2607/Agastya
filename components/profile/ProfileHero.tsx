import { Pressable, Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { Icon, PrimaryButton } from '@/components/ui';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors } from '@/constants/theme';

type ProfileHeroProps = {
  displayName: string;
  emailLabel: string;
  avatarId?: string | null;
  premium: boolean;
  onAvatarPress: () => void;
  onEditPress: () => void;
};

/**
 * Compact identity hero — horizontal layout, restrained glass, dominant name.
 * Membership lives in MembershipCard below (single indicator).
 */
export function ProfileHero({
  displayName,
  emailLabel,
  avatarId,
  premium,
  onAvatarPress,
  onEditPress,
}: ProfileHeroProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420 }}
      className="w-full">
      <GlassCard muted className="w-full px-4 py-4" innerClassName="gap-4">
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={onAvatarPress}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            accessibilityHint="Opens edit profile"
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <View
              className="rounded-full border"
              style={{
                borderColor: premium ? 'rgba(34,211,238,0.4)' : 'rgba(168,85,247,0.35)',
                borderWidth: 1.5,
                padding: 2,
              }}>
              <ProfileAvatar avatarId={avatarId} displayName={displayName} size={64} animated={false} />
            </View>
          </Pressable>

          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="font-headline text-[24px] text-on-surface"
              style={{ lineHeight: 30 }}
              accessibilityRole="header"
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}>
              {displayName}
            </Text>
            <Text
              className="font-body text-[13px] leading-5 text-on-surface-variant"
              maxFontSizeMultiplier={1.4}
              numberOfLines={1}>
              {emailLabel}
            </Text>
          </View>
        </View>

        <PrimaryButton
          label="Edit profile"
          variant="ghost"
          onPress={onEditPress}
          icon={<Icon name="edit" size={16} color={colors.onSurface} />}
        />
      </GlassCard>
    </MotiView>
  );
}

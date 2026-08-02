import { Platform, Pressable, Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { ProfileActionCard } from '@/components/profile/ProfileActionCard';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { STACK_GAP } from '@/constants/layout';

type ProfileHeroProps = {
  displayName: string;
  emailLabel: string;
  avatarId?: string | null;
  premium: boolean;
  onAvatarPress: () => void;
  onEditPress: () => void;
  onSharePress: () => void;
};

/**
 * Compact identity hero — photo + name, then a single full-width Edit / Share bar.
 */
export function ProfileHero({
  displayName,
  emailLabel,
  avatarId,
  premium,
  onAvatarPress,
  onEditPress,
  onSharePress,
}: ProfileHeroProps) {
  const shareIcon = Platform.OS === 'ios' ? 'ios_share' : 'share';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420 }}
      className="w-full"
      style={{ gap: STACK_GAP }}>
      <GlassCard muted className="w-full px-4 py-4" innerClassName="gap-0">
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
      </GlassCard>

      <GlassCard muted className="w-full overflow-hidden" innerClassName="flex-row p-0">
        <View className="min-w-0 flex-1">
          <ProfileActionCard
            title="Edit Profile"
            icon="edit"
            onPress={onEditPress}
            accessibilityLabel="Edit Profile"
            accessibilityHint="Opens edit profile"
          />
        </View>
        <View className="w-px self-stretch bg-white/10" accessibilityElementsHidden importantForAccessibility="no" />
        <View className="min-w-0 flex-1">
          <ProfileActionCard
            title="Share"
            icon={shareIcon}
            onPress={onSharePress}
            accessibilityLabel="Share Agastya"
            accessibilityHint="Opens the share sheet to invite a friend"
          />
        </View>
      </GlassCard>
    </MotiView>
  );
}

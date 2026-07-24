import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { BrandWordmark } from '@/components/ui';
import { getAvatarOption } from '@/constants/avatars';
import { useSessionStore } from '@/store/sessionStore';
import { initialsFor } from '@/utils/initials';

type MainCosmicHeaderProps = {
  displayName?: string;
  /** Overrides store avatar when passed (e.g. profile preview). */
  avatarId?: string | null;
  onProfilePress?: () => void;
};

/**
 * Top app bar — Agastya wordmark (leading) + profile avatar (trailing).
 * Account actions live on Profile; no hamburger / overflow menu.
 */
export function MainCosmicHeader({
  displayName,
  avatarId: avatarIdProp,
  onProfilePress,
}: MainCosmicHeaderProps) {
  const pathname = usePathname();
  const onProfileTab = pathname.includes('/profile');
  const storedAvatarId = useSessionStore((s) => s.avatarId);
  const avatar = getAvatarOption(avatarIdProp ?? storedAvatarId);

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    if (!onProfileTab) {
      router.push('/(main)/profile');
    }
  };

  return (
    <View className="relative z-10 w-full px-2 pb-2 pt-1">
      <View className="min-h-[44px] flex-row items-center justify-between">
        <View className="min-w-0 flex-1 items-start justify-center pr-3">
          <BrandWordmark />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onProfileTab ? 'Your profile' : 'Open profile'}
          onPress={handleProfilePress}
          className="z-10 h-11 w-11 overflow-hidden rounded-full border active:opacity-90"
          style={{ borderColor: 'rgba(168,85,247,0.35)' }}>
          {avatar ? (
            <Image source={avatar.source} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['rgba(168,85,247,0.45)', 'rgba(232,121,249,0.35)']}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text className="font-label text-[13px] tracking-wide text-on-surface">
                {initialsFor(displayName)}
              </Text>
            </LinearGradient>
          )}
        </Pressable>
      </View>
    </View>
  );
}

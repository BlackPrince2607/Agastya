import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

import { BrandWordmark, Icon } from '@/components/ui';
import { getAvatarOption } from '@/constants/avatars';
import { useSessionStore } from '@/store/sessionStore';
import { initialsFor } from '@/utils/initials';

type MainCosmicHeaderProps = {
  displayName?: string;
  /** Overrides store avatar when passed (e.g. profile preview). */
  avatarId?: string | null;
  onProfilePress?: () => void;
  onMenuPress?: () => void;
};

/** Stitch top app bar: menu (left), Agastya wordmark (center), avatar (right). */
export function MainCosmicHeader({
  displayName,
  avatarId: avatarIdProp,
  onProfilePress,
  onMenuPress,
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={onMenuPress ?? handleProfilePress}
          className="z-10 h-11 w-11 items-center justify-center rounded-full active:opacity-80">
          <Icon name="menu" size={24} color={colors.growth} />
        </Pressable>

        <View
          pointerEvents="none"
          className="absolute inset-x-0 items-center justify-center"
          style={{ top: 0, bottom: 0 }}>
          <BrandWordmark />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
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

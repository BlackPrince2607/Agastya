import { MotiView } from 'moti';
import { Image, Text, View } from 'react-native';

import { getAvatarOption } from '@/constants/avatars';
import { colors } from '@/constants/theme';
import { initialsFor } from '@/utils/initials';

type ProfileAvatarProps = {
  avatarId?: string | null;
  displayName?: string | null;
  size?: number;
  /** Soft pulse glow when an avatar is selected. */
  animated?: boolean;
};

export function ProfileAvatar({
  avatarId,
  displayName,
  size = 64,
  animated = false,
}: ProfileAvatarProps) {
  const option = getAvatarOption(avatarId);
  const initial = initialsFor(displayName ?? undefined);
  const borderWidth = size >= 56 ? 2 : 1.5;
  const fontSize = Math.max(11, Math.round(size * 0.36));

  const face = option ? (
    <Image
      source={option.source}
      style={{ width: size, height: size }}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, backgroundColor: 'rgba(168,85,247,0.2)' }}>
      <Text className="font-headline text-on-surface" style={{ fontSize }}>
        {initial}
      </Text>
    </View>
  );

  return (
    <View style={{ width: size, height: size }}>
      {animated && option ? (
        <MotiView
          from={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0.75, scale: 1.08 }}
          transition={{ type: 'timing', duration: 1800, loop: true, repeatReverse: true }}
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderWidth: 2,
            borderColor: colors.purple,
          }}
        />
      ) : null}
      <View
        className="overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          borderWidth,
          borderColor: 'rgba(168,85,247,0.4)',
        }}>
        {face}
      </View>
    </View>
  );
}

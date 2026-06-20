import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

import { BrandWordmark, Icon } from '@/components/ui';

type MainCosmicHeaderProps = {
  displayName?: string;
  onProfilePress?: () => void;
  onMenuPress?: () => void;
};

function initialsFor(name?: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'A';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Stitch top app bar: menu (left), Agastya wordmark (center), avatar (right). */
export function MainCosmicHeader({ displayName, onProfilePress, onMenuPress }: MainCosmicHeaderProps) {
  return (
    <View className="w-full flex-row items-center justify-between border-b border-white/10 px-2 pb-3 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu"
        onPress={onMenuPress ?? onProfilePress}
        className="h-10 w-10 items-center justify-center rounded-full active:opacity-80">
        <Icon name="menu" size={24} color="#c084fc" />
      </Pressable>

      <BrandWordmark />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={onProfilePress}
        className="h-10 w-10 overflow-hidden rounded-full border border-white/20 active:opacity-90"
        style={{ borderColor: 'rgba(168,85,247,0.35)' }}>
        <LinearGradient
          colors={['rgba(168,85,247,0.45)', 'rgba(232,121,249,0.35)']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text className="font-label text-[13px] tracking-wide text-on-surface">
            {initialsFor(displayName)}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

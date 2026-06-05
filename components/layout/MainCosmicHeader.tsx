import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

type MainCosmicHeaderProps = {
  displayName?: string;
  onProfilePress?: () => void;
};

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** SaaS-style header: avatar, greeting, profile action */
export function MainCosmicHeader({ displayName, onProfilePress }: MainCosmicHeaderProps) {
  const name = displayName?.trim();
  const greeting = name ? `${timeGreeting()}, ${name}` : timeGreeting();

  return (
    <View className="mb-1 w-full flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={onProfilePress}
        className="h-12 w-12 overflow-hidden rounded-full border border-stitch-violet/35 active:opacity-90">
        <LinearGradient
          colors={['rgba(121,246,255,0.35)', 'rgba(168,85,247,0.55)']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person" size={22} color="#e8e4ff" />
        </LinearGradient>
      </Pressable>

      <Text className="mx-3 flex-1 font-inter-medium text-[17px] text-mist" numberOfLines={1}>
        {greeting}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={onProfilePress}
        className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] active:opacity-90">
        <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.75)" />
      </Pressable>
    </View>
  );
}

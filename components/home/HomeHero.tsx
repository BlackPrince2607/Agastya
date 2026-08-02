import { Text, View } from 'react-native';

import { MysticalParticles } from '@/components/home/MysticalParticles';
import { MotiView } from '@/components/moti/MotiView';

type HomeHeroProps = {
  greeting: string;
};

/**
 * Premium home hero: greeting over soft radial glows + sparse particles.
 * Daily insight lives in the focal InsightCard below.
 */
export function HomeHero({ greeting }: HomeHeroProps) {
  return (
    <View className="relative w-full overflow-hidden rounded-glass px-1 py-2">
      <View
        pointerEvents="none"
        className="absolute -left-10 -top-8 h-40 w-40 rounded-full"
        style={{ backgroundColor: 'rgba(168,85,247,0.18)' }}
      />
      <View
        pointerEvents="none"
        className="absolute -right-8 top-6 h-32 w-32 rounded-full"
        style={{ backgroundColor: 'rgba(232,121,249,0.12)' }}
      />
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full"
        style={{ backgroundColor: 'rgba(34,211,238,0.08)' }}
      />
      <MysticalParticles />

      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 520 }}>
        <View className="relative z-10 pt-1">
          <Text
            className="font-headline text-[34px] text-on-surface"
            style={{ lineHeight: 42, paddingBottom: 2 }}
            accessibilityRole="header">
            {greeting}
          </Text>
        </View>
      </MotiView>
    </View>
  );
}

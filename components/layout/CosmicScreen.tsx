import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { gradients } from '@/constants/theme';

type CosmicScreenProps = PropsWithChildren<{
  insetTop?: boolean;
  /** Kept for API compatibility; both variants now render the Cosmic Essence void. */
  variant?: 'aurora' | 'stitch';
}>;

/**
 * Full-bleed Cosmic Essence background: near-flat void (#0f0e10) with soft
 * radial nebula glows in the corners (Stitch body `radial-gradient` accents).
 */
export function CosmicScreen({ children, insetTop = true }: CosmicScreenProps) {
  const body = insetTop ? (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
      {children}
    </SafeAreaView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0e10' }}>
      <LinearGradient colors={[...gradients.cosmic]} style={{ flex: 1 }}>
        {/* Corner nebula glows */}
        <View
          pointerEvents="none"
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10"
        />
        <View
          pointerEvents="none"
          className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full"
          style={{ backgroundColor: 'rgba(34,211,238,0.08)' }}
        />
        {body}
      </LinearGradient>
    </View>
  );
}

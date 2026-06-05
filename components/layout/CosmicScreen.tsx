import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { stitchMd3 } from '@/constants/stitchWelcome';
import { cosmicGradients } from '@/constants/theme';

type CosmicScreenProps = PropsWithChildren<{
  insetTop?: boolean;
  /** `stitch` — flat MD3 void used on welcome / checkout / login */
  variant?: 'aurora' | 'stitch';
}>;

/** Full-bleed background + optional safe inset */
export function CosmicScreen({ children, insetTop = true, variant = 'aurora' }: CosmicScreenProps) {
  const body = insetTop ? (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
      {children}
    </SafeAreaView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );

  if (variant === 'stitch') {
    return (
      <View style={{ flex: 1, backgroundColor: stitchMd3.background }}>
        <LinearGradient
          colors={['rgba(211,190,235,0.08)', stitchMd3.background, 'rgba(0,206,209,0.06)']}
          locations={[0, 0.55, 1]}
          style={{ flex: 1 }}>
          {body}
        </LinearGradient>
      </View>
    );
  }

  return (
    <LinearGradient colors={[...cosmicGradients.aurora]} style={{ flex: 1 }}>
      {body}
    </LinearGradient>
  );
}

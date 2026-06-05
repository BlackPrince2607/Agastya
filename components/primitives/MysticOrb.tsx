import { MotiView } from '@/components/moti/MotiView';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { cosmicGradients } from '@/constants/theme';

type MysticOrbProps = {
  size?: number;
  breathing?: boolean;
};

export function MysticOrb({ size = 220, breathing = true }: MysticOrbProps) {
  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <MotiView
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        animate={{
          scale: breathing ? [1, 1.06, 1] : 1,
          opacity: breathing ? [0.85, 1, 0.85] : 1,
        }}
        transition={{ type: 'timing', duration: 4200, loop: breathing, repeatReverse: breathing }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowColor: '#8b5cf6',
            shadowOpacity: 0.55,
            shadowRadius: 36,
            shadowOffset: { width: 0, height: 0 },
          }}>
          <LinearGradient
            colors={[...cosmicGradients.pulse]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{
              flex: 1,
              borderRadius: size / 2,
              opacity: 0.9,
            }}
          />
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(5,2,10,0)', 'rgba(5,2,10,0.65)']}
          style={{
            position: 'absolute',
            width: size * 0.92,
            height: size * 0.92,
            borderRadius: size * 0.46,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
          }}
        />
      </MotiView>
    </View>
  );
}

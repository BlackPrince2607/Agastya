import { MotiView } from '@/components/moti/MotiView';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import type { AuraProfile } from '@/types/report';

type Props = PropsWithChildren<{ aura: AuraProfile }>;

export function AuraNebulaCard({ aura }: Props) {
  return (
    <MotiView
      animate={{ opacity: [0.88, 1, 0.88], scale: [0.997, 1.01, 0.997] }}
      transition={{ type: 'timing', duration: 7000, loop: true }}>
      <View className="overflow-hidden rounded-4xl border border-white/12">
        <LinearGradient
          colors={[...aura.gradient] as [string, string, ...string[]]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ opacity: 0.55 }}>
          <LinearGradient colors={['rgba(5,2,14,0.2)', 'rgba(10,12,42,0.92)']} style={{ padding: 26 }}>
            <Text className="text-[13px] font-semibold uppercase tracking-[0.35em] text-white/82">Aura resonance</Text>
            <Text className="mt-4 text-[24px] font-semibold tracking-tight text-white">{aura.label}</Text>
            <Text className="mt-4 max-w-[88%] text-[14px] leading-6 text-mist/90">
              The glow is narrative chrome—emotionally sharp, aesthetically charged. Carry it as shorthand for how others
              read your presence before you introduce yourself.
            </Text>
          </LinearGradient>
        </LinearGradient>
      </View>
    </MotiView>
  );
}

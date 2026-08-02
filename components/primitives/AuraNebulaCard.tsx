import { MotiView } from '@/components/moti/MotiView';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { AuraProfile } from '@/types/report';

type Props = PropsWithChildren<{ aura: AuraProfile }>;

export function AuraNebulaCard({ aura }: Props) {
  const reduceMotion = useReduceMotion();

  const card = (
    <View className="overflow-hidden rounded-4xl border border-white/18">
      <LinearGradient
        colors={[...aura.gradient] as [string, string, ...string[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ opacity: 0.92 }}>
        <LinearGradient colors={['rgba(5,2,14,0.08)', 'rgba(10,12,42,0.62)']} style={{ padding: 26 }}>
          <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-white/90">Aura resonance</Text>
          <Text className="mt-4 font-headline text-[24px] tracking-tight text-white">{aura.label}</Text>
          <Text className="mt-4 max-w-[88%] font-body text-[14px] leading-6 text-white/88">
            The glow is narrative chrome—emotionally sharp, aesthetically charged. Carry it as shorthand for how others
            read your presence before you introduce yourself.
          </Text>
        </LinearGradient>
      </LinearGradient>
    </View>
  );

  if (reduceMotion) return card;

  return (
    <MotiView
      animate={{ opacity: [0.94, 1, 0.94], scale: [0.997, 1.01, 0.997] }}
      transition={{ type: 'timing', duration: 7000, loop: true }}>
      {card}
    </MotiView>
  );
}

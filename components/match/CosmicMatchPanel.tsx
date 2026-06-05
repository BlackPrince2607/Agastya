import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { MetricBar } from '@/components/match/MetricBar';
import { EntertainmentDisclaimer } from '@/components/legal/EntertainmentDisclaimer';
import { CosmicButton, GlowCard, GradientText } from '@/components/primitives';
import {
  compatibilityAffinity,
  compatibilityDimensions,
  matchStrengthLabel,
} from '@/utils/compatibilityScore';

type CosmicMatchPanelProps = {
  defaultSelfName?: string;
  onOpenGuide?: () => void;
};

export function CosmicMatchPanel({ defaultSelfName = '', onOpenGuide }: CosmicMatchPanelProps) {
  const [selfName, setSelfName] = useState(defaultSelfName);
  const [partnerName, setPartnerName] = useState('');

  const affinity = useMemo(
    () => compatibilityAffinity(selfName || 'you', partnerName || 'partner'),
    [selfName, partnerName],
  );
  const dimensions = useMemo(
    () => compatibilityDimensions(selfName || 'you', partnerName || 'partner'),
    [selfName, partnerName],
  );
  const strength = matchStrengthLabel(affinity);

  return (
    <View className="w-full gap-6">
      <View className="flex-row items-center justify-between px-1">
        <AvatarRing tint="cyan" />
        <LinearGradient
          colors={['#d392f6', '#f472b6']}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="heart" size={26} color="#fff" />
        </LinearGradient>
        <AvatarRing tint="violet" outline />
      </View>

      <View className="items-center">
        <GradientText className="font-noto-serif text-[48px] font-semibold">{affinity}%</GradientText>
        <Text className="mt-1 font-inter-medium text-[15px] text-stitch-signal">{strength}</Text>
      </View>

      <GlowCard className="gap-3">
        <TextInput
          value={selfName}
          onChangeText={setSelfName}
          placeholder="Your name"
          placeholderTextColor="rgba(255,255,255,0.35)"
          accessibilityLabel="Your name"
          className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3.5 font-inter text-[16px] text-mist"
        />
        <TextInput
          value={partnerName}
          onChangeText={setPartnerName}
          placeholder="Their name"
          accessibilityLabel="Their name"
          placeholderTextColor="rgba(255,255,255,0.35)"
          className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3.5 font-inter text-[16px] text-mist"
        />
      </GlowCard>

      <View className="gap-4">
        {dimensions.map((d) => (
          <MetricBar key={d.key} label={d.label} pct={d.pct} />
        ))}
      </View>

      {onOpenGuide ? (
        <CosmicButton gradient="nebulaMd3" label="Ask the Guide" onPress={onOpenGuide} />
      ) : null}

      <EntertainmentDisclaimer dense />
    </View>
  );
}

function AvatarRing({ tint, outline }: { tint: 'cyan' | 'violet'; outline?: boolean }) {
  const border = tint === 'cyan' ? 'border-stitch-signal/40' : 'border-stitch-violet/45';
  const colors =
    tint === 'cyan'
      ? (['rgba(0,206,209,0.35)', 'rgba(121,246,255,0.15)'] as const)
      : (['rgba(211,146,246,0.4)', 'rgba(168,85,247,0.2)'] as const);

  return (
    <View className={`h-20 w-20 overflow-hidden rounded-full border-2 ${border}`}>
      <LinearGradient colors={colors} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={outline ? 'person-outline' : 'person'} size={36} color="#e8e4ff" />
      </LinearGradient>
    </View>
  );
}

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionHeader } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { EntertainmentDisclaimer } from '@/components/legal/EntertainmentDisclaimer';
import { CosmicButton, GlowCard, GradientText } from '@/components/primitives';
import { DATING_PROFILES } from '@/constants/dating';
import { track } from '@/services/analytics';
import { useSessionStore } from '@/store/sessionStore';
import { datingProfileAffinity, matchStrengthLabel } from '@/utils/compatibilityScore';

export default function DatingScreen() {
  const displayName = useSessionStore((s) => s.userDisplayName);
  const readingSeed = useSessionStore((s) => s.readingSeed);
  const seekerKey = `${readingSeed}::${displayName?.trim() || 'seeker'}`;

  const profiles = useMemo(
    () =>
      DATING_PROFILES.map((p) => ({
        ...p,
        affinity: datingProfileAffinity(seekerKey, p.id),
      })).sort((a, b) => b.affinity - a.affinity),
    [seekerKey],
  );

  const connect = (name: string, affinity: number) => {
    track('dating_connect_tap', { profile: name, affinity });
    router.push({
      pathname: '/guide',
      params: { icebreaker: `I matched ${affinity}% with ${name}. Help me start a conversation.` },
    });
  };

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <SectionHeader
          title="Discover"
          subtitle="Explore sample profiles for fun—scores are for entertainment, not real matching."
        />

        <View className="w-full gap-3">
          {profiles.map((profile) => (
            <GlowCard key={profile.id} className="gap-3 py-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${profile.accent}33` }}>
                    <Text className="font-inter-medium text-[18px] text-mist">{profile.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text className="font-inter-medium text-[17px] text-mist">{profile.name}</Text>
                    <Text className="text-[13px] text-md-on-surface-variant">{profile.archetype}</Text>
                  </View>
                </View>
                <GradientText className="text-[18px] font-semibold">{profile.affinity}%</GradientText>
              </View>
              <Text className="text-[14px] leading-5 text-md-on-surface-variant" numberOfLines={2}>
                {profile.vibe}
              </Text>
              <View className="flex-row items-center justify-between gap-3">
                <Pressable onPress={() => router.push('/match')} className="active:opacity-80">
                  <Text className="text-[13px] text-md-on-surface-variant">Compare match</Text>
                </Pressable>
                <View className="min-w-[120px] flex-1">
                  <CosmicButton
                    gradient="nebulaMd3"
                    label="Connect"
                    onPress={() => connect(profile.name, profile.affinity)}
                  />
                </View>
              </View>
            </GlowCard>
          ))}
        </View>

        <EntertainmentDisclaimer dense />
      </MainTabScroll>
    </CosmicScreen>
  );
}

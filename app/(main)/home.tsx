import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionHeader, InlineError, StatusPill } from '@/components/feedback';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { CosmicButton, GlowCard, InsightCard } from '@/components/primitives';
import {
  buildDailyInsight,
  displayNameOrDefault,
  HOME_SHORTCUTS,
  JOURNEY_DAY_FOOTNOTE,
  JOURNEY_DAY_LABEL,
  OFFLINE_LIMITED_LABEL,
  type HomeShortcutAction,
} from '@/constants/userCopy';
import { getApiHealth } from '@/services/connectivity';
import { useSessionStore } from '@/store/sessionStore';
import { seedDigits } from '@/utils/deterministicNumbers';

function openShortcut(action: HomeShortcutAction, premium: boolean) {
  switch (action) {
    case 'guide':
      router.push('/guide');
      break;
    case 'compat':
      router.push('/match');
      break;
    case 'dating':
      router.push('/dating');
      break;
    case 'tasks':
      router.push('/tasks');
      break;
    case 'report':
      router.push('/report');
      break;
    case 'paywall':
      router.push(premium ? '/report' : '/onboarding/paywall');
      break;
  }
}

export default function HomeDashboardScreen() {
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const readingSeed = useSessionStore((s) => s.readingSeed);
  const syncNotice = useSessionStore((s) => s.syncNotice);
  const dismissedUpgrade = useSessionStore((s) => s.dismissedUpgradeCard);
  const setSyncNotice = useSessionStore((s) => s.setSyncNotice);
  const setDismissedUpgrade = useSessionStore((s) => s.setDismissedUpgradeCard);

  const quickInsight = useMemo(() => buildDailyInsight(palmAnalysis), [palmAnalysis]);
  const journeyDays = useMemo(() => 3 + Math.floor((seedDigits(readingSeed, 1)[0] ?? 0) * 5), [readingSeed]);
  const apiLimited = getApiHealth()?.ok === false;

  const greeting = displayNameOrDefault(displayName);

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />

        <Text className="font-inter-medium text-[22px] text-mist" accessibilityRole="header">
          {greeting === 'Your profile' ? 'Welcome' : `Hi, ${greeting}`}
        </Text>

        {apiLimited ? <StatusPill label={OFFLINE_LIMITED_LABEL} variant="offline" /> : null}

        {syncNotice ? (
          <InlineError message={syncNotice} onDismiss={() => setSyncNotice(null)} />
        ) : null}

        <InsightCard insight={quickInsight} />

        {!premium && !dismissedUpgrade ? (
          <GlowCard className="w-full border-stitch-violet/30 py-3.5">
            <View className="flex-row items-center gap-2">
              <Pressable
                className="flex-1 active:opacity-90"
                onPress={() => router.push('/onboarding/paywall')}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro">
                <Text className="font-inter-medium text-[15px] text-mist">Upgrade to Pro</Text>
                <Text className="mt-0.5 text-[13px] text-md-on-surface-variant">
                  Full report, compatibility details, and unlimited Guide
                </Text>
              </Pressable>
              <Pressable onPress={() => setDismissedUpgrade(true)} hitSlop={12} accessibilityLabel="Dismiss upgrade">
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
          </GlowCard>
        ) : null}

        <SectionHeader title="Explore" subtitle="Jump to what matters today" />
        <QuickAccessGrid items={HOME_SHORTCUTS} premium={premium} onPress={(a) => openShortcut(a, premium)} />

        <Pressable
          onPress={() => router.push('/dating')}
          className="w-full active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="Open dating discover">
          <GlowCard className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-stitch-violet/25">
                <Ionicons name="people" size={20} color="#d392f6" />
              </View>
              <View>
                <Text className="font-inter-medium text-[15px] text-mist">Discover</Text>
                <Text className="mt-0.5 text-[13px] text-md-on-surface-variant">Explore connections for fun</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
          </GlowCard>
        </Pressable>

        <GlowCard muted className="flex-row items-center gap-4 py-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20">
            <Ionicons name="flame" size={24} color="#fb923c" />
          </View>
          <View className="flex-1">
            <Text className="font-inter-medium text-[16px] text-mist">{JOURNEY_DAY_LABEL(journeyDays)}</Text>
            <Text className="mt-0.5 text-[13px] text-md-on-surface-variant">{JOURNEY_DAY_FOOTNOTE}</Text>
          </View>
        </GlowCard>

        {!palmAnalysis ? (
          <CosmicButton
            gradient="nebulaMd3"
            label="Complete your palm reading"
            onPress={() => router.push('/onboarding/palm-scan')}
          />
        ) : null}
      </MainTabScroll>
    </CosmicScreen>
  );
}

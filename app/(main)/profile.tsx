import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { SectionHeader } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MembershipBadge } from '@/components/profile/MembershipBadge';
import { CosmicButton, GlowCard } from '@/components/primitives';
import { LEGAL_URLS } from '@/constants/legal';
import { displayNameOrDefault, SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { useAuthSession } from '@/hooks/useAuthSession';
import { signInFromProfile, signOutAndReturnToWelcome } from '@/services/authSession';
import { unlockPremiumFromStore } from '@/services/premiumUnlock';
import { isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { replayOnboarding } from '@/utils/navigationFlow';

type IconName = ComponentProps<typeof Ionicons>['name'];

type RowProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  tint?: string;
  last?: boolean;
};

function SettingsRow({ icon, label, onPress, accessibilityLabel, tint, last }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 py-3.5 active:opacity-80 ${last ? '' : 'border-b border-white/[0.06]'}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}>
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
        <Ionicons name={icon} size={18} color={tint ?? '#d392f6'} />
      </View>
      <Text className="flex-1 font-inter text-[15px] text-mist">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const name = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const hasEnteredMain = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, email, loading: authLoading } = useAuthSession();

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const displayName = displayNameOrDefault(name);
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A';

  const handleRestorePurchases = async () => {
    if (restoreBusy) return;
    setRestoreBusy(true);
    try {
      const result = await unlockPremiumFromStore({ mode: 'restore' });
      Alert.alert(
        result.ok ? 'Subscription restored' : 'No subscription found',
        result.ok
          ? 'Pro is active on this account.'
          : 'We couldn’t find an active subscription for this store account.',
      );
    } finally {
      setRestoreBusy(false);
    }
  };

  const openLink = (url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert('Unable to open link', 'Please try again in a moment.'));
  };

  const confirmStartOver = () => {
    Alert.alert(
      'Start over?',
      'You’ll go through setup again. Your current reading stays on this device until you sign out.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start over', onPress: () => replayOnboarding() },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime to restore your reading.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSignOutBusy(true);
          void signOutAndReturnToWelcome().finally(() => setSignOutBusy(false));
        },
      },
    ]);
  };

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <View className="w-full flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-stitch-violet/35 bg-stitch-violet/20">
            <Text className="font-noto-serif text-[24px] text-mist">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-inter-medium text-[20px] text-mist" accessibilityRole="header" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="mt-0.5 text-[13px] text-md-on-surface-variant" numberOfLines={1}>
              {isSignedIn ? email ?? 'Signed in' : 'Not signed in'}
            </Text>
          </View>
          <MembershipBadge premium={premium} />
        </View>

        {!premium ? (
          <Pressable
            onPress={() => router.push('/onboarding/paywall')}
            className="w-full active:opacity-90"
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro">
            <GlowCard className="flex-row items-center gap-3 border-stitch-violet/30 py-4">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-stitch-violet/25">
                <Ionicons name="sparkles" size={20} color="#d392f6" />
              </View>
              <View className="flex-1">
                <Text className="font-inter-medium text-[15px] text-mist">Upgrade to Pro</Text>
                <Text className="mt-0.5 text-[13px] text-md-on-surface-variant">
                  Full report, compatibility, and unlimited Guide
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
            </GlowCard>
          </Pressable>
        ) : null}

        <SectionHeader title="Your reading" />
        <GlowCard className="w-full py-1">
          <SettingsRow icon="document-text-outline" label="Palm report" onPress={() => router.push('/report')} />
          <SettingsRow icon="heart-outline" label="Compatibility" onPress={() => router.push('/report/compatibility')} last />
        </GlowCard>

        <SectionHeader title="Subscription" />
        <GlowCard className="w-full py-1">
          {!premium ? (
            <SettingsRow icon="sparkles-outline" label="Upgrade to Pro" onPress={() => router.push('/onboarding/paywall')} />
          ) : null}
          <SettingsRow
            icon="refresh-outline"
            label={restoreBusy ? 'Restoring…' : 'Restore purchases'}
            onPress={() => void handleRestorePurchases()}
            last
          />
        </GlowCard>

        <SectionHeader title="Account" />
        <GlowCard className="w-full">
          <Text className="text-[14px] leading-6 text-md-on-surface-variant">
            {authLoading
              ? 'Loading…'
              : isSignedIn
                ? 'Your reading is backed up and synced across devices.'
                : isSupabaseEnabled
                  ? 'Sign in to back up your reading and sync it across devices.'
                  : SIGN_IN_UNAVAILABLE}
          </Text>
          <View className="mt-4 gap-2">
            {isSignedIn ? (
              <CosmicButton
                variant="ghost"
                label={signOutBusy ? 'Signing out…' : 'Sign out'}
                disabled={signOutBusy}
                onPress={handleSignOut}
              />
            ) : isSupabaseEnabled ? (
              <CosmicButton gradient="nebulaMd3" label="Sign in" onPress={() => void signInFromProfile()} />
            ) : null}
            {hasEnteredMain ? (
              <CosmicButton variant="ghost" label="Start over" onPress={confirmStartOver} />
            ) : null}
          </View>
        </GlowCard>

        <SectionHeader title="About" />
        <GlowCard className="w-full py-1">
          <SettingsRow icon="lock-closed-outline" label="Privacy policy" onPress={() => openLink(LEGAL_URLS.privacy)} />
          <SettingsRow icon="document-outline" label="Terms of use" onPress={() => openLink(LEGAL_URLS.terms)} last />
        </GlowCard>

        <Text className="text-center text-[12px] leading-5 text-md-on-surface-variant">
          For entertainment and reflection only—not medical, legal, or financial advice.
        </Text>
      </MainTabScroll>
    </CosmicScreen>
  );
}

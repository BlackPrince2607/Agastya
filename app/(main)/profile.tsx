import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { SectionHeader } from '@/components/feedback';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MembershipBadge } from '@/components/profile/MembershipBadge';
import { CosmicButton, GlowCard } from '@/components/primitives';
import { GlassCard, Icon, type IconName } from '@/components/ui';
import { LEGAL_URLS } from '@/constants/legal';
import { colors } from '@/constants/theme';
import { displayNameOrDefault, SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { useAuthSession } from '@/hooks/useAuthSession';
import { signInFromProfile, signOutAndReturnToWelcome, resetLocalAndSignOut } from '@/services/authSession';
import { unlockPremiumFromStore } from '@/services/premiumUnlock';
import { isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { initialsFor } from '@/utils/initials';
import { replayOnboarding } from '@/utils/navigationFlow';

type RowProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  tint?: string;
  last?: boolean;
  destructive?: boolean;
};

function SettingsRow({ icon, label, onPress, accessibilityLabel, tint, last, destructive }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 py-3.5 active:opacity-80 ${last ? '' : 'border-b border-white/[0.06]'}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}>
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon name={icon} size={18} color={tint ?? colors.purple} />
      </View>
      <Text className={`flex-1 font-body text-[15px] ${destructive ? 'text-error' : 'text-on-surface'}`}>
        {label}
      </Text>
      <Icon name="chevron_right" size={18} color="rgba(255,255,255,0.35)" />
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
  const [startFreshBusy, setStartFreshBusy] = useState(false);

  const displayName = displayNameOrDefault(name);
  const initial = initialsFor(displayName);

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
      'Choose how you want to reset your journey.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replay setup',
          onPress: () => replayOnboarding(),
        },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: () => {
            setStartFreshBusy(true);
            void resetLocalAndSignOut().finally(() => setStartFreshBusy(false));
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your reading stays on this device. Use Start fresh in Profile if you want to wipe everything.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setSignOutBusy(true);
            void signOutAndReturnToWelcome().finally(() => setSignOutBusy(false));
          },
        },
      ],
    );
  };

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <View className="w-full flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-purple/35 bg-primary/20">
            <Text className="font-headline text-[24px] text-on-surface">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-headline-md text-[20px] text-on-surface" accessibilityRole="header" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="mt-0.5 font-body text-[13px] text-on-surface-variant" numberOfLines={1}>
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
            <GlassCard glow className="flex-row items-center gap-3 p-4">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/25">
                <Icon name="auto_awesome" size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-headline-md text-[15px] text-on-surface">Upgrade to Pro</Text>
                <Text className="mt-0.5 font-body text-[13px] text-on-surface-variant">
                  Full report, compatibility, and unlimited Guide
                </Text>
              </View>
              <Icon name="chevron_right" size={18} color="rgba(255,255,255,0.45)" />
            </GlassCard>
          </Pressable>
        ) : null}

        <SectionHeader title="Your reading" />
        <GlowCard className="w-full py-1">
          <SettingsRow icon="description" label="Palm report" onPress={() => router.push('/report')} />
          <SettingsRow icon="favorite_border" label="Compatibility" onPress={() => router.push('/report/compatibility')} last />
        </GlowCard>

        <SectionHeader title="Subscription" />
        <GlowCard className="w-full py-1">
          {!premium ? (
            <SettingsRow icon="auto_awesome" label="Upgrade to Pro" onPress={() => router.push('/onboarding/paywall')} />
          ) : null}
          <SettingsRow
            icon="refresh"
            label={restoreBusy ? 'Restoring…' : 'Restore purchases'}
            onPress={() => void handleRestorePurchases()}
            last
          />
        </GlowCard>

        <SectionHeader title="Account" />
        <GlowCard className="w-full">
          <Text className="font-body text-[14px] leading-6 text-on-surface-variant">
            {authLoading
              ? 'Loading…'
              : isSignedIn
                ? 'Your reading is backed up and synced across devices.'
                : isSupabaseEnabled
                  ? 'Sign in to back up your reading, sync across devices, and access the app.'
                  : SIGN_IN_UNAVAILABLE}
          </Text>
          <View className="mt-4 gap-3">
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
              <CosmicButton
                variant="ghost"
                label={startFreshBusy ? 'Resetting…' : 'Start over'}
                disabled={startFreshBusy || signOutBusy}
                onPress={confirmStartOver}
              />
            ) : null}
          </View>
        </GlowCard>

        <SectionHeader title="About" />
        <GlowCard className="w-full py-1">
          <SettingsRow icon="lock" label="Privacy policy" onPress={() => openLink(LEGAL_URLS.privacy)} />
          <SettingsRow icon="article" label="Terms of use" onPress={() => openLink(LEGAL_URLS.terms)} last />
        </GlowCard>

        <Text className="text-center font-body text-[12px] leading-5 text-on-surface-variant">
          For entertainment and reflection only—not medical, legal, or financial advice.
        </Text>
      </MainTabScroll>
    </CosmicScreen>
  );
}

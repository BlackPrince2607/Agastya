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
import { resetLocalAndSignOut, signInFromProfile, signOutAndReturnToWelcome } from '@/services/authSession';
import { unlockPremiumFromStore } from '@/services/premiumUnlock';
import { isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { replayOnboarding } from '@/utils/navigationFlow';

type RowProps = { label: string; onPress: () => void; accessibilityLabel?: string };

function SettingsRow({ label, onPress, accessibilityLabel }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3.5 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}>
      <Text className="font-inter text-[15px] text-mist">{label}</Text>
      <Text className="text-md-on-surface-variant">›</Text>
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const displayName = displayNameOrDefault(name);

  const handleRestorePurchases = async () => {
    if (restoreBusy) return;
    setRestoreBusy(true);
    try {
      const result = await unlockPremiumFromStore({ mode: 'restore' });
      Alert.alert(
        result.ok ? 'Subscription restored' : 'No subscription found',
        result.ok ? 'Pro is active on this account.' : 'We couldn’t find an active subscription for this store account.',
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
      'You’ll go through setup again. Your reading on this device stays until you clear data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start over', onPress: () => replayOnboarding() },
      ],
    );
  };

  const confirmClearData = () => {
    Alert.alert('Clear data on this device?', 'Removes your local reading and signs you out.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear data', style: 'destructive', onPress: () => void resetLocalAndSignOut() },
    ]);
  };

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <View className="w-full flex-row items-center justify-between">
          <Text className="font-inter-medium text-[22px] text-mist" accessibilityRole="header">
            {displayName}
          </Text>
          <MembershipBadge premium={premium} />
        </View>

        <SectionHeader title="Your reading" />
        <GlowCard className="w-full px-1">
          <SettingsRow label="Palm report" onPress={() => router.push('/report')} />
          <View className="h-px bg-white/8" />
          <SettingsRow label="Compatibility" onPress={() => router.push('/match')} />
          <View className="h-px bg-white/8" />
          <SettingsRow label="Discover" onPress={() => router.push('/dating')} />
        </GlowCard>

        <SectionHeader title="Subscription" />
        <GlowCard className="w-full px-1">
          {!premium ? (
            <>
              <SettingsRow label="Upgrade to Pro" onPress={() => router.push('/onboarding/paywall')} />
              <View className="h-px bg-white/8" />
            </>
          ) : null}
          <SettingsRow
            label={restoreBusy ? 'Restoring…' : 'Restore purchases'}
            onPress={() => void handleRestorePurchases()}
          />
        </GlowCard>

        <SectionHeader title="Account" />
        <GlowCard className="w-full">
          <Text className="text-[14px] text-md-on-surface-variant">
            {authLoading
              ? 'Loading…'
              : isSignedIn
                ? email ?? 'Signed in'
                : isSupabaseEnabled
                  ? 'Sign in to sync your reading across devices'
                  : SIGN_IN_UNAVAILABLE}
          </Text>
          <View className="mt-4 gap-2">
            {isSignedIn ? (
              <CosmicButton
                variant="ghost"
                label={signOutBusy ? 'Signing out…' : 'Sign out'}
                disabled={signOutBusy}
                onPress={() => {
                  Alert.alert('Sign out?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      onPress: () => {
                        setSignOutBusy(true);
                        void signOutAndReturnToWelcome().finally(() => setSignOutBusy(false));
                      },
                    },
                  ]);
                }}
              />
            ) : isSupabaseEnabled ? (
              <CosmicButton gradient="nebulaMd3" label="Sign in" onPress={() => void signInFromProfile()} />
            ) : null}
          </View>
        </GlowCard>

        <SectionHeader title="Legal" />
        <GlowCard className="w-full px-1">
          <SettingsRow label="Privacy policy" onPress={() => openLink(LEGAL_URLS.privacy)} />
          <SettingsRow label="Terms of use" onPress={() => openLink(LEGAL_URLS.terms)} />
        </GlowCard>

        <Pressable
          onPress={() => setAdvancedOpen((v) => !v)}
          className="flex-row items-center justify-between py-2 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={advancedOpen ? 'Collapse advanced settings' : 'Expand advanced settings'}>
          <Text className="font-inter-medium text-[15px] text-mist">Advanced</Text>
          <Text className="text-md-on-surface-variant">{advancedOpen ? '−' : '+'}</Text>
        </Pressable>

        {advancedOpen ? (
          <GlowCard className="w-full gap-2">
            {hasEnteredMain ? (
              <CosmicButton variant="ghost" label="Start over" onPress={confirmStartOver} />
            ) : null}
            <CosmicButton variant="ghost" label="Clear data on this device" onPress={confirmClearData} />
            {__DEV__ ? (
              <Text className="text-center text-[12px] text-md-on-surface-variant">
                Developer builds may include extra diagnostics.
              </Text>
            ) : null}
          </GlowCard>
        ) : null}

        <Text className="text-center text-[12px] leading-5 text-md-on-surface-variant">
          For entertainment and reflection only—not medical, legal, or financial advice.
        </Text>
      </MainTabScroll>
    </CosmicScreen>
  );
}

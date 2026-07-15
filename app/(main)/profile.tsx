import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';

import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { MotiView } from '@/components/moti/MotiView';
import { DevPremiumPanel } from '@/components/dev/DevPremiumPanel';
import { MembershipCard } from '@/components/profile/MembershipCard';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { SettingsRow } from '@/components/profile/SettingsRow';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { StatsGrid } from '@/components/profile/StatCard';
import { SectionHeader } from '@/components/feedback';
import { LEGAL_URLS } from '@/constants/legal';
import { MAIN_SECTION_GAP, STACK_GAP } from '@/constants/layout';
import { displayNameOrDefault, SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { useAuthSession } from '@/hooks/useAuthSession';
import { warmUpOAuthBrowser, coolDownOAuthBrowser } from '@/services/oauthBrowser';
import { signInFromProfile, signOutAndReturnToWelcome, resetLocalAndSignOut, deleteAccountAndReset } from '@/services/authSession';
import { unlockPremiumFromStore } from '@/services/premiumUnlock';
import { isSupabaseEnabled } from '@/services/supabase';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { replayOnboarding } from '@/utils/navigationFlow';
import { paywallRouteParams } from '@/utils/paywallNavigation';
import { previewReportHref } from '@/utils/premiumAccess';

function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Platform.OS === 'android'
        ? Constants.expoConfig?.android?.versionCode?.toString()
        : undefined;
  return build ? `${version} (${build})` : version;
}

function storeSubscriptionsUrl(): string | null {
  if (Platform.OS === 'ios') return 'https://apps.apple.com/account/subscriptions';
  if (Platform.OS === 'android') return 'https://play.google.com/store/account/subscriptions';
  return null;
}

export default function ProfileScreen() {
  const name = useSessionStore((s) => s.userDisplayName);
  const avatarId = useSessionStore((s) => s.avatarId);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const hasEnteredMain = useSessionStore((s) => s.hasEnteredMain);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const partnerPalmAnalysis = useSessionStore((s) => s.partnerPalmAnalysis);
  const { isSignedIn, email, loading: authLoading } = useAuthSession();

  const streak = useTaskStore((s) => s.streak);
  const messageCount = useChatStore((s) => s.messageCount);

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [startFreshBusy, setStartFreshBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    warmUpOAuthBrowser();
    return () => {
      coolDownOAuthBrowser();
    };
  }, []);

  const displayName = displayNameOrDefault(name);
  const emailLabel = isSignedIn ? email ?? 'Signed in' : 'Not signed in';
  const version = useMemo(() => appVersionLabel(), []);

  const reportsGenerated = (palmAnalysis ? 1 : 0) + (partnerPalmAnalysis ? 1 : 0);
  const manageSubsUrl = storeSubscriptionsUrl();

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
      'Choose how you want to reset your progress.',
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, cloud backup, palm images, and reading history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setDeleteBusy(true);
            void deleteAccountAndReset()
              .catch((err) => {
                const message = err instanceof Error ? err.message : 'Could not delete your account. Please try again.';
                Alert.alert('Delete failed', message);
              })
              .finally(() => setDeleteBusy(false));
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

  const goEditProfile = () => router.push('/edit-profile');
  const goUpgrade = () => router.push(paywallRouteParams('/(main)/profile'));

  const accountBusy = signOutBusy || deleteBusy || startFreshBusy;

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll sectionGap={MAIN_SECTION_GAP}>
        <MainCosmicHeader displayName={name} avatarId={avatarId} />

        {/* Identity cluster — tighter gaps; major sections use MAIN_SECTION_GAP */}
        <View style={{ width: '100%', gap: STACK_GAP }}>
          <ProfileHero
            displayName={displayName}
            emailLabel={emailLabel}
            avatarId={avatarId}
            premium={premium}
            onAvatarPress={goEditProfile}
            onEditPress={goEditProfile}
          />
          <MembershipCard premium={premium} onPress={premium ? undefined : goUpgrade} />
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 70 }}
            className="w-full">
            <StatsGrid
              items={[
                {
                  icon: 'local_fire_department',
                  label: 'Streak',
                  value: streak,
                  accessibilityLabel: `Current streak: ${streak} days`,
                },
                {
                  icon: 'description',
                  label: 'Reports',
                  value: reportsGenerated,
                  accessibilityLabel: `Reports generated: ${reportsGenerated}`,
                },
                {
                  icon: 'chat_bubble',
                  label: 'Chats',
                  value: messageCount,
                  accessibilityLabel: `Conversations: ${messageCount}`,
                },
                {
                  icon: 'calendar_today',
                  label: 'Plan',
                  value: premium ? 'Pro' : 'Free',
                  accessibilityLabel: `Plan: ${premium ? 'Pro' : 'Free'}`,
                },
              ]}
            />
          </MotiView>
        </View>

        <SettingsSection index={0} title="Reading" subtitle="Palm insights and compatibility">
          {!palmAnalysis ? (
            <SettingsRow
              icon="front_hand"
              title="Start your first reading"
              subtitle="Scan your palm to unlock insights"
              onPress={() => router.push('/onboarding/palm-scan')}
            />
          ) : null}
          <SettingsRow
            icon="description"
            title="Palm report"
            subtitle="Lines, traits, and full reading"
            onPress={() => router.push(premium ? '/report' : previewReportHref())}
          />
          <SettingsRow
            icon="favorite_border"
            title="Compatibility"
            subtitle="See how your energies align"
            onPress={() => router.push(premium ? '/report/compatibility' : paywallRouteParams('/(main)/profile'))}
            last
          />
        </SettingsSection>

        <SettingsSection index={1} title="Subscription" subtitle="Membership and billing">
          <SettingsRow
            icon="refresh"
            title={restoreBusy ? 'Restoring…' : 'Restore purchases'}
            subtitle="Recover Pro on this device"
            onPress={() => void handleRestorePurchases()}
            last={!manageSubsUrl || !premium}
          />
          {premium && manageSubsUrl ? (
            <SettingsRow
              icon="settings"
              title="Manage subscription"
              subtitle={Platform.OS === 'ios' ? 'App Store subscriptions' : 'Play Store subscriptions'}
              onPress={() => openLink(manageSubsUrl)}
              last
            />
          ) : null}
        </SettingsSection>

        <SettingsSection index={2} title="Account" subtitle="Identity, backup, and security">
          <SettingsRow
            icon="edit"
            title="Edit profile"
            subtitle="Name, avatar, and focus areas"
            onPress={goEditProfile}
            last={authLoading}
          />
          {authLoading ? null : isSignedIn ? (
            <>
              <SettingsRow
                icon="cloud_done"
                title="Cloud backup"
                subtitle="Reading synced across devices"
                showChevron={false}
              />
              <SettingsRow
                icon="logout"
                title={signOutBusy ? 'Signing out…' : 'Sign out'}
                onPress={accountBusy ? undefined : handleSignOut}
                disabled={accountBusy}
                accessibilityLabel="Sign out"
              />
              <SettingsRow
                icon="delete_outline"
                title={deleteBusy ? 'Deleting account…' : 'Delete account'}
                destructive
                onPress={accountBusy ? undefined : handleDeleteAccount}
                disabled={accountBusy}
                last={!hasEnteredMain}
              />
              {hasEnteredMain ? (
                <SettingsRow
                  icon="refresh"
                  title={startFreshBusy ? 'Resetting…' : 'Start over'}
                  subtitle="Replay setup or wipe this device"
                  onPress={accountBusy ? undefined : confirmStartOver}
                  disabled={accountBusy}
                  last
                />
              ) : null}
            </>
          ) : isSupabaseEnabled ? (
            <SettingsRow
              icon="person"
              title="Sign in"
              subtitle="Back up and sync your reading"
              onPress={() => void signInFromProfile()}
              last
            />
          ) : (
            <SettingsRow
              icon="info"
              title="Sign-in unavailable"
              subtitle={SIGN_IN_UNAVAILABLE}
              showChevron={false}
              last
            />
          )}
        </SettingsSection>

        <SettingsSection index={3} title="About" subtitle="Legal and app information">
          <SettingsRow icon="lock" title="Privacy policy" onPress={() => openLink(LEGAL_URLS.privacy)} />
          <SettingsRow icon="article" title="Terms of use" onPress={() => openLink(LEGAL_URLS.terms)} />
          <SettingsRow icon="info" title="Version" subtitle={version} showChevron={false} last />
        </SettingsSection>

        {__DEV__ ? (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 280 }}
            className="w-full"
            style={{ gap: STACK_GAP }}>
            <SectionHeader title="Developer" subtitle="Visible only in development builds" />
            <DevPremiumPanel showOpenReport />
          </MotiView>
        ) : null}
      </MainTabScroll>
    </CosmicScreen>
  );
}

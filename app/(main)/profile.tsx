import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';

import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { MotiView } from '@/components/moti/MotiView';
import { MembershipCard } from '@/components/profile/MembershipCard';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { SettingsRow } from '@/components/profile/SettingsRow';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { StatsGrid } from '@/components/profile/StatCard';
import { LoadingBlock } from '@/components/feedback';
import { GlassCard, InsightCard } from '@/components/ui';
import { LEGAL_URLS } from '@/constants/legal';
import { MAIN_SECTION_GAP, STACK_GAP } from '@/constants/layout';
import {
  displayNameOrDefault,
  PROFILE_JOURNEY_LOADING,
  PROFILE_TIMELINE_EMPTY,
  PROFILE_WEEKLY_EMPTY,
  SIGN_IN_UNAVAILABLE,
} from '@/constants/userCopy';
import { useAuthSession } from '@/hooks/useAuthSession';
import { warmUpOAuthBrowser, coolDownOAuthBrowser } from '@/services/oauthBrowser';
import { signInFromProfile, signOutAndReturnToWelcome, resetLocalAndSignOut, deleteAccountAndReset } from '@/services/authSession';
import { fetchJourneyTimeline, fetchWeeklySummary } from '@/services/agastyaApi';
import { readThisWeeksLocalSummary, writeLocalWeekly } from '@/services/guidanceCache';
import { AnalyticsEvent, trackOnce } from '@/services/analytics';
import { checkPremiumStatus } from '@/services/premiumUnlock';
import { isSupabaseEnabled } from '@/services/supabase';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import { withApiRetry } from '@/utils/apiRetry';
import { replayOnboarding } from '@/utils/navigationFlow';
import { paywallRouteParams } from '@/utils/paywallNavigation';
import { previewReportHref } from '@/utils/premiumAccess';
import { shareAgastya } from '@/utils/shareAgastya';

function ritualsCompletedTotal(history: Record<string, string[]>): number {
  return Object.values(history).reduce((sum, ids) => sum + ids.length, 0);
}

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

function storePurchasesUrl(): string | null {
  if (Platform.OS === 'android') {
    return 'https://play.google.com/store/account/orderhistory';
  }
  return null;
}

function JourneyEmptyContent({
  title,
  body,
  showEyebrow = true,
}: {
  title: string;
  body: string;
  showEyebrow?: boolean;
}) {
  return (
    <View className="gap-2">
      {showEyebrow ? (
        <Text className="font-label text-[11px] uppercase tracking-[0.14em] text-primary">Your journey</Text>
      ) : null}
      <Text className="font-headline-md text-[18px] text-on-surface" maxFontSizeMultiplier={1.35}>
        {title}
      </Text>
      <Text className="font-body text-[14px] leading-6 text-on-surface-variant" maxFontSizeMultiplier={1.35}>
        {body}
      </Text>
    </View>
  );
}

function JourneyEmptyShell({ title, body }: { title: string; body: string }) {
  return (
    <GlassCard muted className="w-full" innerClassName="p-5">
      <JourneyEmptyContent title={title} body={body} />
    </GlassCard>
  );
}

export default function ProfileScreen() {
  const name = useSessionStore((s) => s.userDisplayName);
  const avatarId = useSessionStore((s) => s.avatarId);
  const sessionId = useSessionStore((s) => s.sessionId);
  const focusTopics = useSessionStore((s) => s.focusTopics);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const hasEnteredMain = useSessionStore((s) => s.hasEnteredMain);
  const palmAnalysis = useSessionStore((s) => s.palmAnalysis);
  const partnerPalmAnalysis = useSessionStore((s) => s.partnerPalmAnalysis);
  const { isSignedIn, email, loading: authLoading } = useAuthSession();

  const streak = useTaskStore((s) => s.streak);
  const history = useTaskStore((s) => s.history);
  const messageCount = useChatStore((s) => s.messageCount);

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [startFreshBusy, setStartFreshBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [weekly, setWeekly] = useState<{
    title: string;
    body: string;
    currentChapter?: string | null;
  } | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; label: string; detail: string }>>([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyLoaded, setJourneyLoaded] = useState(false);

  const completedRituals = useMemo(() => ritualsCompletedTotal(history), [history]);

  useEffect(() => {
    warmUpOAuthBrowser();
    return () => {
      coolDownOAuthBrowser();
    };
  }, []);

  useEffect(() => {
    if (!palmAnalysis || !sessionId) {
      setJourneyLoading(false);
      setJourneyLoaded(false);
      return;
    }
    let active = true;
    setJourneyLoading(true);

    const load = async () => {
      // Snapshot ritual stats at call time — do not re-POST when streak bumps.
      const taskSnap = useTaskStore.getState();
      const ritualsTotal = ritualsCompletedTotal(taskSnap.history) || undefined;
      const stats = {
        streak: taskSnap.streak > 0 ? taskSnap.streak : undefined,
        ritualsCompletedTotal: ritualsTotal,
      };

      const localWeekly = await readThisWeeksLocalSummary();
      if (!active) return;
      if (localWeekly) {
        setWeekly({
          title: localWeekly.title,
          body: localWeekly.body,
          currentChapter: localWeekly.currentChapter ?? null,
        });
        trackOnce(`weekly_summary_viewed:${localWeekly.weekKey}`, AnalyticsEvent.WEEKLY_SUMMARY_VIEWED, {
          source: 'profile',
          week_key: localWeekly.weekKey,
        });
      }

      try {
        const timelinePromise = withApiRetry(() => fetchJourneyTimeline({ sessionId, ...stats }));
        const weeklyPromise = localWeekly
          ? Promise.resolve(null)
          : withApiRetry(() =>
              fetchWeeklySummary({
                sessionId,
                palmAnalysis,
                focusTopics: focusTopics ?? [],
                ...stats,
              }),
            );

        const [weeklyRes, timelineRes] = await Promise.all([weeklyPromise, timelinePromise]);
        if (!active) return;
        if (weeklyRes?.title && weeklyRes.body) {
          setWeekly({
            title: weeklyRes.title,
            body: weeklyRes.body,
            currentChapter: weeklyRes.currentChapter ?? null,
          });
          trackOnce(`weekly_summary_viewed:${weeklyRes.weekKey}`, AnalyticsEvent.WEEKLY_SUMMARY_VIEWED, {
            source: 'profile',
            week_key: weeklyRes.weekKey,
          });
          await writeLocalWeekly({
            weekKey: weeklyRes.weekKey,
            title: weeklyRes.title,
            body: weeklyRes.body,
            topTheme: weeklyRes.topTheme ?? null,
            consistencyNote: weeklyRes.consistencyNote ?? null,
            currentChapter: weeklyRes.currentChapter ?? null,
          });
        }
        if (timelineRes.items?.length) {
          setTimeline(timelineRes.items.map((i) => ({ id: i.id, label: i.label, detail: i.detail })));
        } else {
          setTimeline([]);
        }
      } catch {
        /* profile still usable without journey blocks; local weekly may already show */
      } finally {
        if (active) {
          setJourneyLoading(false);
          setJourneyLoaded(true);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [palmAnalysis, sessionId, focusTopics]);

  const displayName = displayNameOrDefault(name);
  const emailLabel = isSignedIn ? email ?? 'Signed in' : 'Not signed in';
  const version = useMemo(() => appVersionLabel(), []);

  const reportsGenerated = (palmAnalysis ? 1 : 0) + (partnerPalmAnalysis ? 1 : 0);
  const managePurchasesUrl = storePurchasesUrl();

  const handleRestorePurchases = async () => {
    if (restoreBusy) return;
    setRestoreBusy(true);
    try {
      const result = await checkPremiumStatus({});
      Alert.alert(
        result.ok ? 'Premium active' : 'No Premium found',
        result.ok
          ? 'Pro is active on this account.'
          : 'We could not find a Premium purchase. If you paid recently, wait a moment and try again.',
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
  const goShareAgastya = () => {
    void shareAgastya();
  };
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
            onSharePress={goShareAgastya}
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

        {weekly && palmAnalysis ? (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 420, delay: 90 }}
            className="w-full">
            <InsightCard
              eyebrow="Current Chapter"
              title={weekly.currentChapter?.trim() || weekly.title}
              body={weekly.body}
              ctaLabel="See your journey"
              accessibilityHint="Opens your palm report and journey"
              onPress={() => router.push('/report')}
            />
          </MotiView>
        ) : journeyLoading && palmAnalysis ? (
          <GlassCard muted className="w-full" innerClassName="p-5">
            <LoadingBlock variant="skeleton" compact message={PROFILE_JOURNEY_LOADING} />
          </GlassCard>
        ) : journeyLoaded && palmAnalysis && !weekly ? (
          <JourneyEmptyShell title={PROFILE_WEEKLY_EMPTY.title} body={PROFILE_WEEKLY_EMPTY.body} />
        ) : null}

        {timeline.length > 0 && palmAnalysis ? (
          <SettingsSection index={0} title="Your journey" subtitle="Moments from your Life Blueprint path">
            <View className="gap-0 py-2">
              {timeline.map((item, index) => (
                <MotiView
                  key={item.id}
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 380, delay: 40 + index * 50 }}
                  className="flex-row gap-3 py-3">
                  <View className="items-center pt-1.5">
                    <View className="h-2 w-2 rounded-full bg-primary" />
                    {index < timeline.length - 1 ? (
                      <View className="mt-1 w-px flex-1 bg-white/15" style={{ minHeight: 28 }} />
                    ) : null}
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="font-headline-md text-[15px] text-on-surface">{item.label}</Text>
                    <Text className="font-body text-[13px] leading-5 text-on-surface-variant">{item.detail}</Text>
                  </View>
                </MotiView>
              ))}
            </View>
          </SettingsSection>
        ) : journeyLoaded && palmAnalysis && timeline.length === 0 ? (
          <SettingsSection index={0} title="Your journey" subtitle="Moments from your Life Blueprint path">
            <View className="py-4">
              <JourneyEmptyContent
                title={PROFILE_TIMELINE_EMPTY.title}
                body={PROFILE_TIMELINE_EMPTY.body}
                showEyebrow={false}
              />
            </View>
          </SettingsSection>
        ) : null}

        <SettingsSection index={1} title="Reading" subtitle="Palm insights and compatibility">
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

        <SettingsSection index={2} title="Premium" subtitle="One-time unlock and billing">
          <SettingsRow
            icon="refresh"
            title={restoreBusy ? 'Checking…' : 'Check premium status'}
            subtitle="Sync Premium from your account"
            onPress={() => void handleRestorePurchases()}
            disabled={restoreBusy}
            last={!managePurchasesUrl || !premium}
          />
          {premium && managePurchasesUrl ? (
            <SettingsRow
              icon="settings"
              title="Play purchase history"
              subtitle="View Google Play orders"
              onPress={() => openLink(managePurchasesUrl)}
              last
            />
          ) : null}
        </SettingsSection>

        <SettingsSection index={3} title="Account" subtitle="Identity, backup, and security">
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

        <SettingsSection index={4} title="About" subtitle="Legal and app information">
          <SettingsRow
            icon={Platform.OS === 'ios' ? 'ios_share' : 'share'}
            title="Share"
            subtitle="Invite a friend to Agastya"
            onPress={goShareAgastya}
            accessibilityLabel="Share Agastya"
            accessibilityHint="Opens the share sheet to invite a friend"
          />
          <SettingsRow icon="lock" title="Privacy policy" onPress={() => openLink(LEGAL_URLS.privacy)} />
          <SettingsRow icon="article" title="Terms of use" onPress={() => openLink(LEGAL_URLS.terms)} />
          <SettingsRow icon="info" title="Version" subtitle={version} showChevron={false} last />
        </SettingsSection>
      </MainTabScroll>
    </CosmicScreen>
  );
}

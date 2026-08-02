import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GoogleLogo } from '@/components/auth/GoogleLogo';
import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_COMFORTABLE } from '@/components/layout/StickyActionBar';
import { DecorativePalmArt } from '@/components/onboarding/DecorativePalmArt';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { TrustBadgeRow } from '@/components/onboarding/TrustBadgeRow';
import { GlassCard, CosmicTextField, PrimaryButton } from '@/components/ui';
import { LEGAL_URLS } from '@/constants/legal';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { runNativeOAuth } from '@/services/authCoordinator';
import { alertForAuthFailure, parseAuthFailure } from '@/services/authErrorUtils';
import { isEmailAuthEnabled, isOAuthSignInEnabled } from '@/services/authConfig';
import { setPostSignInReturn } from '@/services/authSession';
import { finishSignIn } from '@/services/authSignIn';
import { warmUpOAuthBrowser } from '@/services/oauthBrowser';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthSession } from '@/hooks/useAuthSession';
import { hasRitualReading } from '@/utils/navigationFlow';

WebBrowser.maybeCompleteAuthSession();

const TRUST_BADGES = [
  { icon: 'cloud_done' as const, label: 'Secure Backup' },
  { icon: 'encrypted' as const, label: 'Private & Safe' },
  { icon: 'devices' as const, label: 'Any Device' },
];

export default function SaveJourneyScreen() {
  const insets = useSafeAreaInsets();
  const { seed, fromPaywall, fromProfile, toPaywall } = useLocalSearchParams<{
    seed?: string;
    fromPaywall?: string;
    fromProfile?: string;
    toPaywall?: string;
  }>();
  const storeSeed = useSessionStore((s) => s.readingSeed);
  const mergedSeed = seed ?? storeSeed ?? 'stillness';
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const hasEnteredMain = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, email: authEmail } = useAuthSession();
  const afterPaywall = fromPaywall === '1';
  const beforePaywall = toPaywall === '1';
  const fromProfileFlow = fromProfile === '1';

  const [email, setEmail] = useState('');
  const [oauthBusy, setOauthBusy] = useState<'apple' | 'google' | null>(null);
  const [enterBusy, setEnterBusy] = useState(false);

  const showOAuth = isOAuthSignInEnabled && !isSignedIn;

  useEffect(() => {
    if (beforePaywall) {
      setPostSignInReturn({
        pathname: '/onboarding/paywall',
        params: { seed: mergedSeed },
      });
    } else if (fromProfileFlow) {
      setPostSignInReturn('/(main)/profile');
    }
  }, [beforePaywall, fromProfileFlow, mergedSeed]);

  useEffect(() => {
    void warmUpOAuthBrowser();
  }, []);

  // Already signed in while heading to pay — skip straight to checkout.
  useEffect(() => {
    if (!beforePaywall || !isSignedIn) return;
    router.replace({
      pathname: '/onboarding/paywall',
      params: { seed: mergedSeed },
    });
  }, [beforePaywall, isSignedIn, mergedSeed]);

  const openLegal = (url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', 'Please try again in a moment.');
    });
  };

  const continueWithEmail = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      Alert.alert('Check your email', 'Enter a valid email address to continue.');
      return;
    }
    router.push({
      pathname: '/onboarding/account-email',
      params: {
        email: trimmed,
        mode: fromProfileFlow ? 'signin' : '',
        seed: mergedSeed,
        fromPaywall: fromPaywall ?? '',
        fromProfile: fromProfile ?? '',
        toPaywall: toPaywall ?? '',
      },
    });
  };

  const oauth = async (provider: 'apple' | 'google') => {
    if (!isSupabaseEnabled || !getSupabase()) {
      Alert.alert('Sign-in unavailable', SIGN_IN_UNAVAILABLE);
      return;
    }
    if (oauthBusy) return;

    setOauthBusy(provider);
    setEnterBusy(true);
    try {
      const result = await runNativeOAuth(provider);
      if (!result.ok) {
        if (result.cancelled) return;
        const alert = alertForAuthFailure(parseAuthFailure(result.message ?? 'Sign-in failed.'));
        Alert.alert(alert.title, alert.body);
        return;
      }
      // runNativeOAuth exchanges the Supabase session and navigates via completeSignIn.
    } catch (err) {
      const alert = alertForAuthFailure(parseAuthFailure(err instanceof Error ? err : String(err)));
      Alert.alert(alert.title, alert.body);
    } finally {
      setEnterBusy(false);
      setOauthBusy(null);
    }
  };

  const continueOnboarding = () => {
    if (enterBusy) return;
    setEnterBusy(true);
    void finishSignIn().finally(() => setEnterBusy(false));
  };

  const headline = fromProfileFlow
    ? 'Sign in to your account'
    : beforePaywall
      ? 'Sign in to unlock Premium'
      : 'Save your reading';
  const subhead = fromProfileFlow
    ? 'Back up your reading and sync across devices.'
    : beforePaywall
      ? 'We attach Premium to your email so access follows you after payment — no second sign-in.'
      : 'Sign in to save your report, chat history, and daily progress on any device.';

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: STICKY_ACTION_BAR_COMFORTABLE + insets.bottom,
              gap: 24,
            }}>
            <OnboardingHeader
              step={ONBOARDING_STEPS.account}
              total={ONBOARDING_TOTAL_STEPS}
              showBack
              useClose
            />

            <View className="overflow-hidden rounded-glass border border-white/10 shadow-aura" style={{ aspectRatio: 4 / 3 }}>
              <DecorativePalmArt opacity={0.82} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              <LinearGradient
                colors={['transparent', 'rgba(20,19,21,0.2)', '#141315']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
              />
            </View>

            <View className="items-center gap-3.5 px-1">
              <Text className="text-center font-headline text-[28px] leading-9 text-on-surface">{headline}</Text>
              <Text className="max-w-sm text-center font-body text-[15px] leading-6 text-on-surface-variant">
                {subhead}
              </Text>
            </View>

            {isSignedIn ? (
              <GlassCard className="w-full px-4 py-3" style={{ borderColor: 'rgba(34,211,238,0.35)' }}>
                <Text className="font-body text-[14px] leading-6 text-cyan">
                  {authEmail ? `Signed in as ${authEmail}.` : "You're signed in."}{' '}
                  {fromProfileFlow
                    ? 'Return to your profile below.'
                    : beforePaywall
                      ? 'Continue to Unlock Premium below.'
                      : hasRitualReading() || hasEnteredMain
                        ? 'Tap Enter Agastya below.'
                        : 'Tap Enter Agastya to restore your journey or start from Home.'}
                </Text>
              </GlassCard>
            ) : null}

            {!fromProfileFlow ? <TrustBadgeRow badges={TRUST_BADGES} /> : null}

            {!isSupabaseEnabled && !isSignedIn ? (
              <GlassCard className="w-full px-4 py-3" style={{ borderColor: 'rgba(251,191,36,0.35)' }}>
                <Text className="font-body text-[14px] leading-6 text-amber-200/90">{SIGN_IN_UNAVAILABLE}</Text>
              </GlassCard>
            ) : null}

            {showOAuth ? (
              <View className="gap-4">
                {Platform.OS === 'ios' ? (
                  <Pressable
                    onPress={() => void oauth('apple')}
                    disabled={oauthBusy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                    accessibilityState={{ disabled: oauthBusy !== null, busy: oauthBusy === 'apple' }}
                    className="flex-row items-center justify-center gap-3"
                    style={({ pressed }) => [
                      styles.oauthButton,
                      styles.appleOauthButton,
                      (pressed || oauthBusy !== null) && styles.pressedButton,
                    ]}>
                    {oauthBusy === 'apple' ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Ionicons name="logo-apple" size={20} color="#000" />
                    )}
                    <Text className="font-body-medium text-[16px] font-semibold text-black">
                      {oauthBusy === 'apple' ? 'Signing in...' : 'Continue with Apple'}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => void oauth('google')}
                  disabled={oauthBusy !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  accessibilityState={{ disabled: oauthBusy !== null, busy: oauthBusy === 'google' }}
                  className="flex-row items-center justify-center gap-3"
                  style={({ pressed }) => [
                    styles.oauthButton,
                    styles.googleOauthButton,
                    (pressed || oauthBusy !== null) && styles.pressedButton,
                  ]}>
                  {oauthBusy === 'google' ? (
                    <ActivityIndicator color="#d3beeb" />
                  ) : (
                    <GoogleLogo size={20} />
                  )}
                    <Text className="font-body-medium text-[16px] font-semibold text-on-surface">
                    {oauthBusy === 'google' ? 'Signing in...' : 'Continue with Google'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {isEmailAuthEnabled && !isSignedIn && showOAuth ? (
              <View className="flex-row items-center gap-4">
                <View className="h-px flex-1 bg-white/10" />
                <Text className="font-label text-[10px] uppercase leading-4 tracking-[0.28em] text-on-surface-variant">
                  Or
                </Text>
                <View className="h-px flex-1 bg-white/10" />
              </View>
            ) : null}

            {isEmailAuthEnabled && !isSignedIn ? (
              <View className="gap-3">
                <CosmicTextField
                  label="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => continueWithEmail()}
                  returnKeyType="go"
                />
                <PrimaryButton label="Continue with Email" onPress={continueWithEmail} />
              </View>
            ) : null}

            <View className="items-center gap-2 pt-1">
              <View className="flex-row justify-center gap-6">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Terms of Use"
                  onPress={() => openLegal(LEGAL_URLS.terms)}>
                  <Text className="font-label text-[11px] uppercase leading-4 tracking-[0.08em] text-on-surface-variant">
                    Terms of Use
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Privacy Policy"
                  onPress={() => openLegal(LEGAL_URLS.privacy)}>
                  <Text className="font-label text-[11px] uppercase leading-4 tracking-[0.08em] text-on-surface-variant">
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
              <Text className="font-label text-[10px] uppercase leading-4 tracking-[0.08em] text-on-surface-variant/70">
                (c) {new Date().getFullYear()} Agastya
              </Text>
            </View>
          </ScrollView>

          <StickyActionBar contentStyle={{ gap: 10 }}>
            <View className="gap-y-3">
              {isSignedIn && fromProfileFlow ? (
                <PrimaryButton label="Back to profile" onPress={() => router.replace('/(main)/profile')} />
              ) : isSignedIn && beforePaywall ? (
                <PrimaryButton
                  label="Continue to Unlock Premium"
                  onPress={() =>
                    router.replace({
                      pathname: '/onboarding/paywall',
                      params: { seed: mergedSeed },
                    })
                  }
                />
              ) : isSignedIn ? (
                <PrimaryButton
                  label={enterBusy ? 'Opening Agastya...' : 'Enter Agastya'}
                  disabled={enterBusy || oauthBusy !== null}
                  onPress={continueOnboarding}
                />
              ) : null}
              {!isSignedIn ? (
                <Text className="mt-1 text-center font-body text-[12px] leading-5 text-on-surface-variant">
                  {beforePaywall
                    ? 'Sign in above, then complete payment to unlock Premium on this account.'
                    : 'Sign in above to save your reading and access the app.'}
                </Text>
              ) : null}
              {!afterPaywall && !beforePaywall && !premium && !fromProfileFlow ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Want full access? Sign in to unlock"
                  onPress={() =>
                    router.replace({
                      pathname: '/onboarding/account',
                      params: { seed: mergedSeed, toPaywall: '1' },
                    })
                  }
                  className="items-center pb-1">
                  <Text className="font-body text-[13px] text-cyan">
                    Want full access? Sign in to unlock
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </StickyActionBar>
        </View>
      </KeyboardAvoidingView>
      {enterBusy ? (
        <View
          style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]}
          className="items-center justify-center bg-black/80 px-8"
          pointerEvents="auto">
          <LoadingBlock message="Signing you in…" />
        </View>
      ) : null}
    </CosmicScreen>
  );
}

const styles = StyleSheet.create({
  oauthButton: {
    minHeight: 58,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#a855f7',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  appleOauthButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: '#ffffff',
  },
  googleOauthButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pressedButton: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});

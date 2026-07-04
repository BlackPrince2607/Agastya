import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
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
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_COMFORTABLE } from '@/components/layout/StickyActionBar';
import { DecorativePalmArt } from '@/components/onboarding/DecorativePalmArt';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { GlassCard, CosmicTextField, Icon, NebulaButton, type IconName } from '@/components/ui';
import { LEGAL_URLS } from '@/constants/legal';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { track } from '@/services/analytics';
import { completeAuthFromUrl, setPendingAuthReturnUrl } from '@/services/authCallback';
import { beginAccountOAuth, endAccountOAuth } from '@/services/authFlow';
import { isEmailAuthEnabled, isOAuthSignInEnabled } from '@/services/authConfig';
import { alertForAuthFailure, parseAuthFailure } from '@/services/authErrorUtils';
import { getAuthRedirectUri } from '@/services/authRedirect';
import { setPostSignInReturn } from '@/services/authSession';
import { finishSignIn } from '@/services/authSignIn';
import { warmUpOAuthBrowser } from '@/services/oauthBrowser';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthSession } from '@/hooks/useAuthSession';
import { hasRitualReading } from '@/utils/navigationFlow';
import { resetAppNavigation } from '@/utils/routerDefer';

WebBrowser.maybeCompleteAuthSession();

const TRUST_BADGES: { icon: IconName; label: string }[] = [
  { icon: 'cloud_done', label: 'Secure Backup' },
  { icon: 'encrypted', label: 'Private & Safe' },
  { icon: 'devices', label: 'Any Device' },
];

export default function SaveJourneyScreen() {
  const insets = useSafeAreaInsets();
  const { seed, fromPaywall, fromProfile, fromWelcome } = useLocalSearchParams<{
    seed?: string;
    fromPaywall?: string;
    fromProfile?: string;
    fromWelcome?: string;
  }>();
  const storeSeed = useSessionStore((s) => s.readingSeed);
  const mergedSeed = seed ?? storeSeed ?? 'stillness';
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const hasEnteredMain = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, email: authEmail } = useAuthSession();
  const afterPaywall = fromPaywall === '1';
  const fromProfileFlow = fromProfile === '1';
  const fromWelcomeFlow = fromWelcome === '1';

  const [email, setEmail] = useState('');
  const [oauthBusy, setOauthBusy] = useState<'apple' | 'google' | null>(null);
  const [enterBusy, setEnterBusy] = useState(false);
  const autoGoogleStarted = useRef(false);

  const redirectUri = getAuthRedirectUri();
  const showOAuth = isOAuthSignInEnabled && !isSignedIn;

  useEffect(() => {
    if (fromProfileFlow) {
      setPostSignInReturn('/(main)/profile');
    }
  }, [fromProfileFlow]);

  useEffect(() => {
    warmUpOAuthBrowser();
  }, []);

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
      },
    });
  };

  const oauth = async (provider: 'apple' | 'google') => {
    const supabase = getSupabase();
    if (!isSupabaseEnabled || !supabase) {
      Alert.alert('Sign-in unavailable', SIGN_IN_UNAVAILABLE);
      return;
    }
    if (oauthBusy) return;

    // Clear any stale "skip cloud restore" flag from a previous "Start fresh" so a
    // returning user's palm reading / report can be pulled back down after sign-in.
    if (useSessionStore.getState().skipCloudRestore) {
      useSessionStore.getState().setSkipCloudRestore(false);
    }

    setOauthBusy(provider);
    beginAccountOAuth();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        const alert = alertForAuthFailure(parseAuthFailure(error));
        Alert.alert(alert.title, alert.body);
        return;
      }

      if (Platform.OS === 'web') {
        if (data.url) {
          window.location.assign(data.url);
        } else {
          Alert.alert('Sign-in unavailable', 'Could not open the sign-in page. Please try again.');
        }
        return;
      }

      if (!data.url) {
        Alert.alert(
          'Sign-in unavailable',
          `Could not start ${provider === 'apple' ? 'Apple' : 'Google'} sign-in. Please try again.`,
        );
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        setPendingAuthReturnUrl(result.url);
        setEnterBusy(true);
        try {
          const authResult = await completeAuthFromUrl(result.url);
          if (!authResult.ok) {
            const alert = alertForAuthFailure(
              parseAuthFailure(authResult.message ?? 'We could not finish signing you in.'),
            );
            Alert.alert(alert.title, alert.body);
            return;
          }
          track('auth_oauth_attempt', { provider });
          try {
            await finishSignIn({ userId: authResult.userId, recovery: authResult.recovery });
          } catch {
            if (authResult.recovery) {
              router.replace('/auth/reset-password');
              return;
            }
            useSessionStore.getState().setEnteredMain(true);
            resetAppNavigation('/(main)/home');
          }
        } finally {
          setEnterBusy(false);
        }
        return;
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      } else {
        Alert.alert(
          'Sign-in incomplete',
          'The sign-in window closed before we could verify your account. Try again.',
        );
      }
    } catch (err) {
      const alert = alertForAuthFailure(parseAuthFailure(err instanceof Error ? err : String(err)));
      Alert.alert(alert.title, alert.body);
    } finally {
      endAccountOAuth();
      setOauthBusy(null);
    }
  };

  useEffect(() => {
    if (!fromWelcomeFlow || !showOAuth || autoGoogleStarted.current || oauthBusy || enterBusy) return;
    autoGoogleStarted.current = true;
    const provider = Platform.OS === 'ios' ? 'apple' : 'google';
    void oauth(provider);
  }, [fromWelcomeFlow, showOAuth, oauthBusy, enterBusy]);

  const continueOnboarding = () => {
    if (enterBusy) return;
    setEnterBusy(true);
    void finishSignIn().finally(() => setEnterBusy(false));
  };

  const headline = fromProfileFlow
    ? 'Sign in to your account'
    : 'Save your reading';
  const subhead = fromProfileFlow
    ? 'Back up your reading and sync across devices.'
    : 'Sign in to save your report, chat history, and daily progress on any device.';

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
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

            <View className="items-center gap-3">
              <Text className="text-center font-headline text-[30px] leading-9 text-on-surface">{headline}</Text>
              <Text className="text-center font-body text-[15px] leading-6 text-on-surface-variant">{subhead}</Text>
            </View>

            {isSignedIn ? (
              <GlassCard className="w-full px-4 py-3" style={{ borderColor: 'rgba(34,211,238,0.35)' }}>
                <Text className="font-body text-[14px] leading-6" style={{ color: '#22d3ee' }}>
                  {authEmail ? `Signed in as ${authEmail}.` : "You're signed in."}{' '}
                  {fromProfileFlow
                    ? 'Return to your profile below.'
                    : hasRitualReading() || hasEnteredMain
                      ? 'Tap Enter Agastya below.'
                      : 'Tap Enter Agastya to restore your journey or start from Home.'}
                </Text>
              </GlassCard>
            ) : null}

            {!fromProfileFlow ? (
              <View className="flex-row gap-3">
                {TRUST_BADGES.map((b) => (
                  <GlassCard key={b.label} className="min-w-0 flex-1 items-center gap-2 px-3 py-3">
                    <Icon name={b.icon} size={22} color="#d3beeb" />
                    <Text className="text-center font-label text-[10px] uppercase tracking-[0.08em] text-on-surface">
                      {b.label}
                    </Text>
                  </GlassCard>
                ))}
              </View>
            ) : null}

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
                <Text className="font-label text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Or</Text>
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
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => continueWithEmail()}
                  returnKeyType="go"
                />
                <NebulaButton label="Continue with Email" onPress={continueWithEmail} />
              </View>
            ) : null}

            <View className="items-center gap-2 pt-1">
              <View className="flex-row justify-center gap-6">
                <Pressable onPress={() => openLegal(LEGAL_URLS.terms)}>
                  <Text className="font-label text-[11px] uppercase tracking-[0.08em] text-on-surface-variant">
                    Terms of Use
                  </Text>
                </Pressable>
                <Pressable onPress={() => openLegal(LEGAL_URLS.privacy)}>
                  <Text className="font-label text-[11px] uppercase tracking-[0.08em] text-on-surface-variant">
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
              <Text className="font-label text-[10px] uppercase tracking-[0.08em] text-on-surface-variant/70">
                (c) {new Date().getFullYear()} Agastya
              </Text>
            </View>
          </ScrollView>

          <StickyActionBar contentStyle={{ gap: 10 }}>
            <View className="gap-y-3">
              {isSignedIn && fromProfileFlow ? (
                <NebulaButton label="Back to profile" onPress={() => router.replace('/(main)/profile')} />
              ) : isSignedIn ? (
                <NebulaButton
                  label={enterBusy ? 'Opening Agastya...' : 'Enter Agastya'}
                  disabled={enterBusy || oauthBusy !== null}
                  onPress={continueOnboarding}
                />
              ) : null}
              {!isSignedIn ? (
                <Text className="mt-1 text-center font-inter text-[12px] leading-5 text-md-on-surface-variant">
                  Sign in above to save your reading and access the app.
                </Text>
              ) : null}
              {!afterPaywall && !premium && !fromProfileFlow ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/onboarding/paywall', params: { seed: mergedSeed } })}
                  className="items-center pb-1">
                  <Text className="font-body text-[13px]" style={{ color: '#22d3ee' }}>
                    Haven't unlocked yet? View plans
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </StickyActionBar>
        </View>
      </KeyboardAvoidingView>
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

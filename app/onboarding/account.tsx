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
import { GlassCard, CosmicTextField, PrimaryButton } from '@/components/ui';
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
import { openLegalDoc } from '@/utils/openLegal';

WebBrowser.maybeCompleteAuthSession();

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
  const beforePaywall = toPaywall === '1';
  const fromProfileFlow = fromProfile === '1';

  const [email, setEmail] = useState('');
  const [oauthBusy, setOauthBusy] = useState<'apple' | 'google' | null>(null);
  const [enterBusy, setEnterBusy] = useState(false);

  const showOAuth = isOAuthSignInEnabled && !isSignedIn;
  const showEmailCta = isEmailAuthEnabled && !isSignedIn;

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
          <View
            style={[
              styles.content,
              { paddingBottom: STICKY_ACTION_BAR_COMFORTABLE + Math.max(insets.bottom, 12) },
            ]}>
            <OnboardingHeader
              step={ONBOARDING_STEPS.account}
              total={ONBOARDING_TOTAL_STEPS}
              showBack
              useClose
            />

            <View style={styles.hero}>
              <DecorativePalmArt opacity={0.88} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={['transparent', 'rgba(20,19,21,0.15)', '#141315']}
                style={styles.heroFade}
              />
            </View>

            <View style={styles.copyBlock}>
              <Text className="text-center font-headline text-[30px] leading-9 tracking-tight text-on-surface">
                {headline}
              </Text>
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

            {!isSupabaseEnabled && !isSignedIn ? (
              <GlassCard className="w-full px-4 py-3" style={{ borderColor: 'rgba(251,191,36,0.35)' }}>
                <Text className="font-body text-[14px] leading-6 text-amber-200/90">{SIGN_IN_UNAVAILABLE}</Text>
              </GlassCard>
            ) : null}

            {showOAuth ? (
              <View style={styles.authStack}>
                {Platform.OS === 'ios' ? (
                  <View style={[styles.oauthBox, styles.appleOauthBox]}>
                    <Pressable
                      onPress={() => void oauth('apple')}
                      disabled={oauthBusy !== null}
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Apple"
                      accessibilityState={{ disabled: oauthBusy !== null, busy: oauthBusy === 'apple' }}
                      style={({ pressed }) => [
                        styles.oauthPressable,
                        (pressed || oauthBusy !== null) && styles.pressedButton,
                      ]}>
                      <View style={styles.oauthInner}>
                        {oauthBusy === 'apple' ? (
                          <ActivityIndicator color="#000" style={styles.oauthIconSlot} />
                        ) : (
                          <View style={styles.oauthIconSlot}>
                            <Ionicons name="logo-apple" size={24} color="#000" />
                          </View>
                        )}
                        <Text style={styles.oauthLabel} numberOfLines={1}>
                          {oauthBusy === 'apple' ? 'Signing in...' : 'Continue with Apple'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}

                {/* Outer View owns the white plate — Pressable styles can fail to paint bg on Android/Expo. */}
                <View style={[styles.oauthBox, styles.googleOauthBox]}>
                  <Pressable
                    onPress={() => void oauth('google')}
                    disabled={oauthBusy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Google"
                    accessibilityState={{ disabled: oauthBusy !== null, busy: oauthBusy === 'google' }}
                    style={({ pressed }) => [
                      styles.oauthPressable,
                      (pressed || oauthBusy !== null) && styles.pressedButton,
                    ]}>
                    <View style={styles.oauthInner}>
                      {oauthBusy === 'google' ? (
                        <ActivityIndicator color="#1f1f1f" style={styles.oauthIconSlot} />
                      ) : (
                        <View style={styles.oauthIconSlot}>
                          <GoogleLogo size={24} />
                        </View>
                      )}
                      <Text style={styles.oauthLabel} numberOfLines={1}>
                        {oauthBusy === 'google' ? 'Signing in...' : 'Continue with Google'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isEmailAuthEnabled && !isSignedIn && showOAuth ? (
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text className="font-label text-[10px] uppercase leading-4 tracking-[0.28em] text-on-surface-variant">
                  Or
                </Text>
                <View style={styles.orLine} />
              </View>
            ) : null}

            {isEmailAuthEnabled && !isSignedIn ? (
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
            ) : null}

            <View style={[styles.legalBlock, { marginTop: 'auto' }]}>
              <View style={styles.legalRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Terms of Use"
                  onPress={() => openLegalDoc('terms')}>
                  <Text className="font-label text-[11px] uppercase leading-4 tracking-[0.08em] text-on-surface-variant">
                    Terms of Use
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Privacy Policy"
                  onPress={() => openLegalDoc('privacy')}>
                  <Text className="font-label text-[11px] uppercase leading-4 tracking-[0.08em] text-on-surface-variant">
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
              <Text className="font-label text-[10px] uppercase leading-4 tracking-[0.08em] text-on-surface-variant/70">
                (c) {new Date().getFullYear()} Agastya
              </Text>
            </View>
          </View>

          <StickyActionBar contentStyle={styles.stickyPanel}>
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
              ) : showEmailCta ? (
                <PrimaryButton label="Continue with Email" onPress={continueWithEmail} />
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 16,
  },
  hero: {
    width: '100%',
    height: 148,
    flexShrink: 0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#141315',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  copyBlock: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  authStack: {
    gap: 12,
    marginTop: 4,
  },
  /** Solid white plate (standard OAuth button look). */
  oauthBox: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  appleOauthBox: {
    borderColor: 'rgba(0,0,0,0.12)',
  },
  googleOauthBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DADCE0',
  },
  oauthPressable: {
    minHeight: 56,
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  oauthInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  oauthIconSlot: {
    width: 28,
    height: 28,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#1F1F1F',
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  legalBlock: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  stickyPanel: {
    gap: 10,
    borderTopWidth: 0,
  },
  pressedButton: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});

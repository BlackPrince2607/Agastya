import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicTextField, GlassCard, NebulaButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import {
  AUTH_ACCOUNT_EXISTS_HINT,
  AUTH_MAGIC_LINK_HELP,
  AUTH_WRONG_PASSWORD_HINT,
  EMAIL_CONFIRM_SENT,
  EMAIL_MAGIC_LINK_SENT,
  EMAIL_RESET_SENT,
  PASSWORD_MISMATCH,
} from '@/constants/userCopy';
import { STITCH_PALM_ART_URI } from '@/constants/stitchWelcome';
import { track } from '@/services/analytics';
import { isMagicLinkEnabled } from '@/services/authConfig';
import {
  probeEmailAccount,
  sendMagicLink,
  sendPasswordReset,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from '@/services/authEmail';
import { getAuthRedirectUri } from '@/services/authRedirect';
import { finishSignIn } from '@/services/authSignIn';
import { resolveAccountBackHref } from '@/utils/navigationFlow';

type EmailStepMode = 'signin' | 'signup';

function redirectBlockedMessage(redirectUri: string): string {
  return `Add this redirect URL in Supabase → Authentication → URL Configuration:\n\n${redirectUri}`;
}

function showRedirectBlockedAlert(redirectUri: string, setLastError: (msg: string) => void) {
  const body = redirectBlockedMessage(redirectUri);
  setLastError(body);
  Alert.alert('Email link blocked', body);
}

export default function AccountEmailScreen() {
  const { email: emailParam, mode: modeParam, seed, fromPaywall, fromProfile } = useLocalSearchParams<{
    email?: string;
    mode?: EmailStepMode;
    seed?: string;
    fromPaywall?: string;
    fromProfile?: string;
  }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<EmailStepMode>(
    modeParam === 'signin' ? 'signin' : modeParam === 'signup' ? 'signup' : 'signup',
  );
  const [probing, setProbing] = useState(!modeParam);
  const [probeUncertain, setProbeUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const email = (emailParam ?? '').trim().toLowerCase();
  const redirectUri = getAuthRedirectUri();

  useEffect(() => {
    if (!email || modeParam) {
      setProbing(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const probe = await probeEmailAccount(email);
      if (cancelled) return;
      if (probe.checked) {
        setMode(probe.exists ? 'signin' : 'signup');
        setProbeUncertain(false);
      } else {
        setMode('signup');
        setProbeUncertain(true);
      }
      setProbing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [email, modeParam]);

  useEffect(() => {
    if (!email) {
      router.replace('/onboarding/account');
    }
  }, [email]);

  const handleBack = () => {
    router.replace(
      resolveAccountBackHref({
        fromPaywall,
        fromProfile,
        seed,
      }),
    );
  };

  const passwordSubmit = async () => {
    setInlineMessage(null);
    setLastError(null);
    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Check your password', PASSWORD_MISMATCH);
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'signin'
          ? await signInWithEmailPassword(email, password)
          : await signUpWithEmailPassword(email, password, redirectUri);

      if (!result.ok) {
        if (result.reason === 'invalid_credentials' && mode === 'signin') {
          Alert.alert('Could not sign in', AUTH_WRONG_PASSWORD_HINT, [
            { text: 'Create account', onPress: () => setMode('signup') },
            { text: 'Email sign-in link', onPress: () => void magicLink() },
            { text: 'OK', style: 'cancel' },
          ]);
          return;
        }
        if (result.reason === 'redirect') {
          showRedirectBlockedAlert(redirectUri, setLastError);
          return;
        }
        if (result.reason === 'rate_limit') {
          setLastError(result.message);
          Alert.alert('Too many attempts', result.message);
          return;
        }
        if (result.reason === 'user_exists' && mode === 'signup') {
          setMode('signin');
          setLastError(AUTH_ACCOUNT_EXISTS_HINT);
          Alert.alert('Account exists', AUTH_ACCOUNT_EXISTS_HINT);
          return;
        }
        setLastError(result.message);
        Alert.alert('Sign-in failed', result.message);
        return;
      }

      if (result.needsEmailConfirmation) {
        setInlineMessage(EMAIL_CONFIRM_SENT);
        Alert.alert('Check your email', EMAIL_CONFIRM_SENT);
        track('auth_signup_confirm_email');
        return;
      }

      track(mode === 'signin' ? 'auth_password_signin' : 'auth_password_signup');
      try {
        await finishSignIn();
      } catch {
        Alert.alert('Signed in', 'You’re signed in. Tap Enter Agastya on the account screen to continue.');
        router.replace('/onboarding/account');
      }
    } finally {
      setBusy(false);
    }
  };

  const magicLink = async () => {
    if (!isMagicLinkEnabled) {
      Alert.alert('Unavailable', 'Email sign-in links are not available right now. Use your password instead.');
      return;
    }
    setInlineMessage(null);
    setLastError(null);
    setBusy(true);
    try {
      const result = await sendMagicLink(email, redirectUri);
      if (!result.ok) {
        if (result.reason === 'redirect') {
          showRedirectBlockedAlert(redirectUri, setLastError);
          return;
        }
        setLastError(result.message);
        Alert.alert('Could not send email', result.message);
        return;
      }
      track('auth_magic_link_dispatched');
      setInlineMessage(`${EMAIL_MAGIC_LINK_SENT} We sent a link to ${email}. ${AUTH_MAGIC_LINK_HELP}`);
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = () => {
    Alert.alert('Reset password', `Send a reset link to ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send link',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const result = await sendPasswordReset(email, redirectUri);
              if (!result.ok) {
                setLastError(result.message);
                Alert.alert('Could not send reset email', result.message);
                return;
              }
              track('auth_password_reset_sent');
              setInlineMessage(`${EMAIL_RESET_SENT} We sent a link to ${email}.`);
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  if (!email) {
    return null;
  }

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <OnboardingScroll>
          <OnboardingHeader showBack useClose onBack={handleBack} />

          <View className="overflow-hidden rounded-glass border border-white/10 shadow-aura" style={{ aspectRatio: 4 / 3 }}>
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: STITCH_PALM_ART_URI }}
              className="h-full w-full"
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(20,19,21,0.2)', '#141315']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
            />
          </View>

          <View className="gap-3">
            <Text className="text-center font-headline text-[28px] leading-9 text-on-surface">
              {probing
                ? 'Checking your account…'
                : mode === 'signin'
                  ? 'Welcome back'
                  : 'Create your account'}
            </Text>
            <Text className="text-center font-body text-[15px] leading-6 text-on-surface-variant">{email}</Text>
          </View>

          {probeUncertain && !probing ? (
            <GlassCard className="w-full px-4 py-3">
              <Text className="font-body text-[14px] leading-6 text-on-surface-variant">
                We could not verify this email automatically. New here? Use Create account or Email me a sign-in link.
              </Text>
            </GlassCard>
          ) : null}

          {__DEV__ ? (
            <GlassCard className="w-full px-4 py-3">
              <Text className="font-label text-[10px] uppercase tracking-[0.08em] text-on-surface-variant">
                Dev — Supabase redirect URL
              </Text>
              <Text selectable className="mt-2 font-body text-[12px] leading-5 text-on-surface-variant">
                {redirectUri}
              </Text>
            </GlassCard>
          ) : null}

          {lastError ? (
            <GlassCard className="w-full px-4 py-3" style={{ borderColor: colors.errorBorder }}>
              <Text className="font-body text-[14px] leading-6 text-error">{lastError}</Text>
            </GlassCard>
          ) : null}

          {inlineMessage ? (
            <GlassCard className="w-full px-4 py-3" style={{ borderColor: colors.successBorder }}>
              <Text className="font-body text-[14px] leading-6 text-success">{inlineMessage}</Text>
            </GlassCard>
          ) : null}

          {!probing ? (
            <View className="gap-4">
              <CosmicTextField
                label="Password"
                secureTextEntry
                showPasswordToggle
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={mode === 'signin' ? 'Your password' : 'Choose a password'}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />

              {mode === 'signup' ? (
                <CosmicTextField
                  label="Confirm password"
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!busy}
                />
              ) : null}

              <NebulaButton
                label={
                  busy
                    ? 'Please wait…'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Create account'
                }
                onPress={() => void passwordSubmit()}
                disabled={busy}
              />

              {mode === 'signin' ? (
                <Pressable onPress={forgotPassword} disabled={busy} className="items-center py-2">
                  <Text className="font-body text-[13px] text-success">Forgot password?</Text>
                </Pressable>
              ) : null}

              {isMagicLinkEnabled ? (
                <>
                  <View className="flex-row items-center gap-4">
                    <View className="h-px flex-1 bg-white/10" />
                    <Text className="font-label text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
                      Or
                    </Text>
                    <View className="h-px flex-1 bg-white/10" />
                  </View>

                  <NebulaButton
                    variant="ghost"
                    label={busy ? 'Sending…' : 'Email me a sign-in link'}
                    onPress={() => void magicLink()}
                    disabled={busy}
                  />
                </>
              ) : null}

              <Pressable
                onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                disabled={busy}
                className="items-center py-2">
                <Text className="font-body text-[13px] text-on-surface-variant">
                  {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </OnboardingScroll>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

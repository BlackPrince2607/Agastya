import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { DecorativePalmArt } from '@/components/onboarding/DecorativePalmArt';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicTextField, GlassCard, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import {
  AUTH_ACCOUNT_EXISTS_HINT,
  AUTH_RATE_LIMIT_HINT,
  AUTH_WRONG_PASSWORD_HINT,
  EMAIL_CONFIRM_SENT,
  EMAIL_MAGIC_LINK_SENT,
  EMAIL_RESET_SENT,
  PASSWORD_MISMATCH,
} from '@/constants/userCopy';
import { track } from '@/services/analytics';
import { isMagicLinkEnabled } from '@/services/authConfig';
import {
  resendSignupConfirmation,
  sendMagicLink,
  sendPasswordReset,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from '@/services/authEmail';
import { getAuthRedirectUri } from '@/services/authRedirect';
import { setPostSignInReturn } from '@/services/authSession';
import { finishSignIn } from '@/services/authSignIn';
import { useSessionStore } from '@/store/sessionStore';
import { resetAppNavigation } from '@/utils/routerDefer';

type EmailStepMode = 'signin' | 'signup';

export default function AccountEmailScreen() {
  const { email: emailParam, mode: modeParam, seed, fromPaywall, fromProfile, toPaywall } = useLocalSearchParams<{
    email?: string;
    mode?: EmailStepMode;
    seed?: string;
    fromPaywall?: string;
    fromProfile?: string;
    toPaywall?: string;
  }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<EmailStepMode>(modeParam === 'signup' ? 'signup' : 'signin');
  const [busy, setBusy] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  const email = (emailParam ?? '').trim().toLowerCase();
  const redirectUri = getAuthRedirectUri();
  const fromProfileFlow = fromProfile === '1';
  const beforePaywall = toPaywall === '1';
  const mergedSeed = seed ?? useSessionStore.getState().readingSeed ?? 'stillness';

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
    if (!email) {
      router.replace('/onboarding/account');
    }
  }, [email]);

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
        if (result.reason === 'rate_limit') {
          if (mode === 'signup') {
            setMode('signin');
          }
          setLastError(AUTH_RATE_LIMIT_HINT);
          Alert.alert('Try signing in', AUTH_RATE_LIMIT_HINT);
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
        setAwaitingEmailConfirm(true);
        setInlineMessage(EMAIL_CONFIRM_SENT);
        Alert.alert('Check your email', EMAIL_CONFIRM_SENT);
        track('auth_signup_confirm_email');
        return;
      }

      track(mode === 'signin' ? 'auth_password_signin' : 'auth_password_signup');
      try {
        await finishSignIn();
      } catch {
        if (fromProfileFlow) {
          router.replace('/(main)/profile');
        } else {
          useSessionStore.getState().setEnteredMain(true);
          resetAppNavigation('/(main)/home');
        }
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
        if (result.reason === 'rate_limit') {
          setLastError(AUTH_RATE_LIMIT_HINT);
          Alert.alert('Try signing in', AUTH_RATE_LIMIT_HINT);
          return;
        }
        setLastError(result.message);
        Alert.alert('Could not send email', result.message);
        return;
      }
      track('auth_magic_link_dispatched');
      setInlineMessage(`${EMAIL_MAGIC_LINK_SENT} We sent a link to ${email}.`);
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setInlineMessage(null);
    setLastError(null);
    setBusy(true);
    try {
      const result = await resendSignupConfirmation(email, redirectUri);
      if (!result.ok) {
        if (result.reason === 'rate_limit') {
          setLastError(AUTH_RATE_LIMIT_HINT);
          Alert.alert('Try again later', AUTH_RATE_LIMIT_HINT);
          return;
        }
        setLastError(result.message);
        Alert.alert('Could not resend email', result.message);
        return;
      }
      track('auth_signup_confirm_resend');
      setInlineMessage(`${EMAIL_CONFIRM_SENT} We sent another link to ${email}.`);
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
                if (result.reason === 'rate_limit') {
                  setLastError(AUTH_RATE_LIMIT_HINT);
                  Alert.alert('Try again later', AUTH_RATE_LIMIT_HINT);
                  return;
                }
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
          <OnboardingHeader showBack useClose />

          <View className="overflow-hidden rounded-glass border border-white/10 shadow-aura" style={{ aspectRatio: 4 / 3 }}>
            <DecorativePalmArt opacity={0.82} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            <LinearGradient
              colors={['transparent', 'rgba(20,19,21,0.2)', '#141315']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
            />
          </View>

          <View className="gap-3">
            <Text className="text-center font-headline text-[28px] leading-9 text-on-surface">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text className="text-center font-body text-[15px] leading-6 text-on-surface-variant">{email}</Text>
          </View>

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

            <PrimaryButton
              label={busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              onPress={() => void passwordSubmit()}
              disabled={busy}
            />

            {awaitingEmailConfirm ? (
              <PrimaryButton
                variant="ghost"
                label={busy ? 'Sending...' : 'Resend confirmation email'}
                onPress={() => void resendConfirmation()}
                disabled={busy}
              />
            ) : null}

            {mode === 'signin' ? (
              <Pressable onPress={forgotPassword} disabled={busy} className="items-center py-2">
                <Text className="font-body text-[13px] text-success">Forgot password?</Text>
              </Pressable>
            ) : null}

            {isMagicLinkEnabled ? (
              <>
                <View className="flex-row items-center gap-4">
                  <View className="h-px flex-1 bg-white/10" />
                  <Text className="font-label text-[10px] uppercase leading-4 tracking-[0.1em] text-on-surface-variant">
                    Or
                  </Text>
                  <View className="h-px flex-1 bg-white/10" />
                </View>

                <PrimaryButton
                  variant="ghost"
                  label={busy ? 'Sending...' : 'Email me a sign-in link'}
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
        </OnboardingScroll>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

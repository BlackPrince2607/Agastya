import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingScroll } from '@/components/layout/OnboardingScroll';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicTextField, NebulaButton } from '@/components/ui';
import { PASSWORD_MISMATCH } from '@/constants/userCopy';
import { createSessionFromUrlDetailed } from '@/services/authCallback';
import { isAuthCallbackUrl } from '@/services/authRedirect';
import { updatePassword } from '@/services/authEmail';
import { finishSignIn } from '@/services/authSignIn';
import { readAuthSession } from '@/services/authSession';

/** Set a new password after opening a Supabase password-recovery link. */
export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    void (async () => {
      let url: string | null = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        url = window.location.href;
      } else {
        url = await Linking.getInitialURL();
      }

      if (url && isAuthCallbackUrl(url)) {
        await createSessionFromUrlDetailed(url);
      }

      const auth = await readAuthSession();
      if (!auth.isSignedIn) {
        setSessionOk(false);
        setChecking(false);
        Alert.alert(
          'Link expired',
          'Open the reset link from your email again, or request a new one from the sign-in screen.',
          [{ text: 'OK', onPress: () => router.replace('/onboarding/account') }],
        );
        return;
      }

      setSessionOk(true);
      setChecking(false);
    })();
  }, []);

  const submit = async () => {
    if (password !== confirm) {
      Alert.alert('Check your password', PASSWORD_MISMATCH);
      return;
    }

    setBusy(true);
    try {
      const result = await updatePassword(password);
      if (!result.ok) {
        Alert.alert('Could not update password', result.message);
        return;
      }
      await finishSignIn();
    } catch {
      Alert.alert('Something went wrong', 'Your password was saved but we could not continue. Try signing in.');
      router.replace('/onboarding/account');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <LoadingBlock message="Verifying your link…" />
        </View>
      </CosmicScreen>
    );
  }

  if (!sessionOk) {
    return (
      <CosmicScreen variant="stitch">
        <View className="flex-1 items-center justify-center px-8">
          <NebulaButton label="Back to sign in" onPress={() => router.replace('/onboarding/account')} />
        </View>
      </CosmicScreen>
    );
  }

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <OnboardingScroll>
          <OnboardingHeader showBack useClose onBack={() => router.replace('/onboarding/account')} />

          <View className="gap-6">
            <View className="gap-2">
              <Text className="font-headline text-[26px] leading-8 text-on-surface">Choose a new password</Text>
              <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
                Enter a new password for your account.
              </Text>
            </View>

            <CosmicTextField
              label="New password"
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
            />

            <CosmicTextField
              label="Confirm password"
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Repeat password"
              value={confirm}
              onChangeText={setConfirm}
            />

            <NebulaButton
              label={busy ? 'Saving…' : 'Update password'}
              onPress={() => void submit()}
              disabled={busy}
            />
          </View>
        </OnboardingScroll>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

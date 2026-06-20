import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Platform, View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { completeAuthFromUrl } from '@/services/authCallback';
import { mapSupabaseAuthError } from '@/services/authErrors';

async function resolveAuthRedirectUrl(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.href;
  }
  return Linking.getInitialURL();
}

/** OAuth / magic-link redirect target — parses URL, merges session, then routes. */
export default function AuthCallbackScreen() {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    void (async () => {
      const url = await resolveAuthRedirectUrl();
      if (!url) {
        Alert.alert('Sign-in incomplete', 'No sign-in data was received. Try again from the account screen.', [
          { text: 'OK', onPress: () => router.replace('/onboarding/account') },
        ]);
        return;
      }

      const result = await completeAuthFromUrl(url);
      if (!result.ok) {
        Alert.alert(
          'Sign-in incomplete',
          mapSupabaseAuthError(result.message ?? 'We could not finish signing you in.'),
          [{ text: 'Try again', onPress: () => router.replace('/onboarding/account') }],
        );
      }
    })();
  }, []);

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 items-center justify-center px-8">
        <LoadingBlock message="Signing you in…" />
      </View>
    </CosmicScreen>
  );
}

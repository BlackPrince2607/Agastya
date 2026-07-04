import { Redirect, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import {
  completeAuthFromUrl,
  peekPendingAuthReturnUrl,
  waitForAuthReturnUrl,
} from '@/services/authCallback';
import { alertForAuthFailure, parseAuthFailure } from '@/services/authErrorUtils';
import { isAuthCallbackUrl } from '@/services/authRedirect';
import { readAuthSession } from '@/services/authSession';
import { finishSignIn } from '@/services/authSignIn';
import { resolvePostSignInHref } from '@/utils/navigationFlow';
import { deferRouterReplace, resetAppNavigation } from '@/utils/routerDefer';

/** OAuth / magic-link redirect target — parses URL, merges session, then routes. */
export default function AuthCallbackScreen() {
  const handled = useRef(false);
  const [redirectHref, setRedirectHref] = useState<Href | null>(null);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const navigate = (href: Href) => {
      if (__DEV__) {
        console.log('[Agastya auth] callback redirect →', href);
      }
      if (href === '/(main)/home') {
        resetAppNavigation(href);
        return;
      }
      deferRouterReplace(href);
    };

    void (async () => {
      try {
        const recoverExistingSession = async () => {
          const auth = await readAuthSession();
          if (!auth.isSignedIn) return false;
          await finishSignIn({ userId: auth.userId });
          return true;
        };

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const url = window.location.href;
          if (!isAuthCallbackUrl(url)) {
            Alert.alert('Sign-in incomplete', 'No sign-in data was received. Try again from the account screen.');
            setRedirectHref('/onboarding/account');
            return;
          }

          const result = await completeAuthFromUrl(url);
          if (!result.ok) {
            if (await recoverExistingSession()) return;
            const alert = alertForAuthFailure(parseAuthFailure(result.message ?? 'We could not finish signing you in.'));
            Alert.alert('Sign-in incomplete', alert.body);
            setRedirectHref('/onboarding/account');
            return;
          }

          window.history.replaceState({}, document.title, '/auth/callback');
          if (result.recovery) {
            setRedirectHref('/auth/reset-password');
            return;
          }
          navigate(await resolvePostSignInHref());
          return;
        }

        const url = peekPendingAuthReturnUrl() ?? (await waitForAuthReturnUrl());
        if (__DEV__) {
          console.log('[Agastya auth] callback url', url ? 'received' : 'missing');
        }

        if (url && isAuthCallbackUrl(url)) {
          const result = await completeAuthFromUrl(url);
          if (!result.ok) {
            if (await recoverExistingSession()) return;
            const alert = alertForAuthFailure(parseAuthFailure(result.message ?? 'We could not finish signing you in.'));
            Alert.alert('Sign-in incomplete', alert.body);
            setRedirectHref('/onboarding/account');
            return;
          }
          if (result.recovery) {
            setRedirectHref('/auth/reset-password');
            return;
          }
          await finishSignIn({ userId: result.userId });
          return;
        }

        const auth = await readAuthSession();
        if (auth.isSignedIn) {
          navigate(await resolvePostSignInHref());
          return;
        }

        setRedirectHref('/onboarding/account');
      } catch (err) {
        if (__DEV__) {
          console.warn('[Agastya auth] callback handler failed', err);
        }
        setRedirectHref('/onboarding/account');
      }
    })();
  }, []);

  if (redirectHref) {
    return <Redirect href={redirectHref} />;
  }

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 items-center justify-center px-8">
        <LoadingBlock message="Signing you in..." />
      </View>
    </CosmicScreen>
  );
}

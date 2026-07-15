import { Redirect, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { LoadingBlock } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ensureWebCrypto } from '@/services/cryptoPolyfill';
import { processAuthCallbackScreen } from '@/services/authCoordinator';

ensureWebCrypto();
WebBrowser.maybeCompleteAuthSession();

const HARD_TIMEOUT_MS = 6_000;

/** OAuth / magic-link redirect target — parses URL, merges session, then routes. */
export default function AuthCallbackScreen() {
  const started = useRef(false);
  const [redirectHref, setRedirectHref] = useState<Href | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const hardTimeout = setTimeout(() => {
      setRedirectHref((current) => current ?? '/onboarding/account');
    }, HARD_TIMEOUT_MS);

    void processAuthCallbackScreen().then((href) => {
      if (href) {
        setRedirectHref(href);
      }
    }).finally(() => {
      clearTimeout(hardTimeout);
    });

    return () => clearTimeout(hardTimeout);
  }, []);

  if (redirectHref) {
    return <Redirect href={redirectHref} />;
  }

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 items-center justify-center px-8">
        <LoadingBlock message="Signing you in…" />
      </View>
    </CosmicScreen>
  );
}

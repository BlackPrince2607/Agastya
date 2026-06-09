import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { fetchApiHealth, registerSession } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { setApiHealth, setApiHealthFailed } from '@/services/connectivity';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { useSessionStore } from '@/store/sessionStore';

const WEB_INSTALL_KEY = 'agastya_web_install_id';

async function resolveInstallId(): Promise<string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const existing = window.localStorage.getItem(WEB_INSTALL_KEY);
      if (existing) return existing;
      const id = Crypto.randomUUID();
      window.localStorage.setItem(WEB_INSTALL_KEY, id);
      return id;
    } catch {
      return 'web-guest';
    }
  }

  try {
    if (Platform.OS === 'android') {
      return Application.getAndroidId();
    }
    if (Platform.OS === 'ios') {
      return (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
    }
  } catch {
    /* ignore */
  }
  return `${Platform.OS}-guest`;
}

/**
 * Ensures anonymous IDs exist locally — remote sync happens via `syncProfileRemote`.
 * If Supabase auth is enabled, reconcile this flow with Supabase session persistence (see services/supabase.ts).
 */
export async function bootstrapIdentity() {
  const snap = useSessionStore.getState();
  let sessionId = snap.sessionId;
  let deviceInstallId = snap.deviceInstallId;

  if (!sessionId) {
    sessionId = Crypto.randomUUID();
  }
  if (!deviceInstallId) {
    deviceInstallId = await resolveInstallId();
  }

  useSessionStore.setState({
    sessionId,
    deviceInstallId,
    identityReady: true,
  });

  void (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const health = await fetchApiHealth(ctrl.signal);
      clearTimeout(t);
      setApiHealth({
        supabase: health.supabase,
        groq: health.groq,
        palm_groq: health.palm_groq,
      });
      track('api_health_ok', {
        supabase: health.supabase,
        groq: health.groq,
        palm_groq: health.palm_groq,
      });
      await restoreSessionFromServer();
    } catch {
      setApiHealthFailed();
      track('api_health_fail');
      if (__DEV__) {
        console.warn(
          '[Agastya] API unreachable — run `npm run api` from the repo root (binds 0.0.0.0:8000). On a physical device set EXPO_PUBLIC_AGASTYA_API_URL to http://YOUR_LAN_IP:8000',
        );
      }
    }
  })();
}

export async function syncProfileRemote() {
  await bootstrapIdentity();
  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) return;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    await registerSession(
      {
        sessionId: snap.sessionId,
        deviceInstallId: snap.deviceInstallId,
        displayName: snap.userDisplayName,
        gender: snap.userGender,
        focusTopics: snap.focusTopics,
      },
      { signal: ctrl.signal },
    );
  } catch (err) {
    if (__DEV__) {
      console.warn(
        '[Agastya] Session register skipped (API offline or misconfigured EXPO_PUBLIC_AGASTYA_API_URL). Onboarding continues locally.',
        err,
      );
    }
  } finally {
    clearTimeout(t);
  }
}

import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { fetchApiHealth, registerSession } from '@/services/agastyaApi';
import { AGASTYA_API_ROOT, isApiConfigured } from '@/services/env';
import { track } from '@/services/analytics';
import { setApiHealth, setApiHealthFailed } from '@/services/connectivity';
import { linkRevenueCatUser } from '@/services/revenuecat';
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
      const androidId = Application.getAndroidId();
      if (androidId) return androidId;
    }
    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) return iosId;
    }
  } catch {
    /* ignore */
  }
  return Crypto.randomUUID();
}

/** Guarantees session + device IDs exist before any API mutation. */
export async function ensureDeviceIdentity(): Promise<{
  sessionId: string;
  deviceInstallId: string;
}> {
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

  return { sessionId, deviceInstallId };
}

/**
 * Ensures anonymous IDs exist locally — remote sync happens via `syncProfileRemote`.
 * If Supabase auth is enabled, reconcile this flow with Supabase session persistence (see services/supabase.ts).
 */
export async function bootstrapIdentity() {
  const { sessionId, deviceInstallId } = await ensureDeviceIdentity();

  void linkRevenueCatUser(sessionId);

  void (async () => {
    if (!isApiConfigured()) {
      setApiHealthFailed();
      return;
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const health = await fetchApiHealth(ctrl.signal);
      clearTimeout(t);
      setApiHealth({
        supabase: health.supabase,
        groq: health.groq ?? health.llm,
        palm_groq: health.palm_groq ?? health.palm_vision,
        llm: health.llm ?? health.groq,
        palm_vision: health.palm_vision ?? health.palm_groq,
      });
      track('api_health_ok', {
        supabase: health.supabase,
        groq: health.groq ?? health.llm,
        palm_groq: health.palm_groq ?? health.palm_vision,
        llm: health.llm ?? health.groq,
        palm_vision: health.palm_vision ?? health.palm_groq,
      });
      if (!useSessionStore.getState().skipCloudRestore) {
        await restoreSessionFromServer();
      }
    } catch (err) {
      setApiHealthFailed();
      track('api_health_fail');
      if (__DEV__) {
        const hint =
          Platform.OS !== 'web'
            ? `Phone must reach ${AGASTYA_API_ROOT} (same Wi-Fi + run npm run api:firewall as Admin). Tunnel only proxies Metro, not port 8000.`
            : 'Run `npm run api` from the repo root.';
        console.warn('[Agastya] API unreachable —', hint, err);
      }
    }
  })();
}

export async function syncProfileRemote() {
  await bootstrapIdentity();
  if (!isApiConfigured()) return;
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

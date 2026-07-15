import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { fetchApiHealthWithRetry, registerSession } from '@/services/agastyaApi';
import { diagnoseReachability, reachabilityDevHint } from '@/services/apiReachability';
import { AGASTYA_API_ROOT, isApiConfigured } from '@/services/env';
import { track } from '@/services/analytics';
import { getApiHealth, setApiHealth, setApiHealthFailed } from '@/services/connectivity';
import { linkRevenueCatUser } from '@/services/revenuecat';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { useSessionStore } from '@/store/sessionStore';

const WEB_INSTALL_KEY = 'agastya_web_install_id';
const HEALTH_COOLDOWN_MS = 30_000;
const HEALTH_FAIL_COOLDOWN_MS = 60_000;

let bootstrapRemoteInFlight: Promise<void> | null = null;
let lastHealthFailAt = 0;

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

let lastReachabilityHint: string | null = null;

async function resolveApiUnreachableDevHint(): Promise<string> {
  const issue = await diagnoseReachability();
  lastReachabilityHint = reachabilityDevHint(issue);
  return lastReachabilityHint;
}

function apiUnreachableDevHint(): string {
  if (lastReachabilityHint) return lastReachabilityHint;
  const root = AGASTYA_API_ROOT;
  try {
    const host = new URL(root).hostname;
    const isHostedHttps =
      root.startsWith('https://') &&
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      !host.startsWith('10.') &&
      !host.startsWith('192.168.');
    if (isHostedHttps) {
      return `Phone must reach ${root}. If Chrome works but Expo Go does not, enable Private DNS (dns.google) — hotspots often block *.up.railway.app.`;
    }
  } catch {
    /* ignore */
  }
  return `Phone must reach ${root} (same Wi-Fi as your PC). For a local API run npm run api:firewall as Admin. Metro tunnel does not proxy port 8000.`;
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

async function runBootstrapRemote(): Promise<void> {
  if (!isApiConfigured()) {
    setApiHealthFailed();
    return;
  }

  const recent = getApiHealth();
  if (recent?.ok && Date.now() - recent.checkedAt < HEALTH_COOLDOWN_MS) {
    return;
  }
  if (!recent?.ok && Date.now() - lastHealthFailAt < HEALTH_FAIL_COOLDOWN_MS) {
    return;
  }

  try {
    if (__DEV__) {
      console.log(`[Agastya API] health check → ${AGASTYA_API_ROOT}/v1/health`);
    }
    if (Platform.OS !== 'web') {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    const health = await fetchApiHealthWithRetry(2, 1500);
    setApiHealth({
      supabase: health.supabase,
      llm: health.llm,
      palm_vision: health.palm_vision,
      chat_model: health.chat_model,
      vision_model: health.vision_model,
    });
    track('api_health_ok', {
      supabase: health.supabase,
      llm: health.llm,
      palm_vision: health.palm_vision,
      chat_model: health.chat_model,
      vision_model: health.vision_model,
    });
    if (!useSessionStore.getState().skipCloudRestore) {
      await restoreSessionFromServer();
    }
  } catch (err) {
    lastHealthFailAt = Date.now();
    setApiHealthFailed();
    track('api_health_fail');
    if (__DEV__) {
      const hint = await resolveApiUnreachableDevHint();
      console.warn('[Agastya] API unreachable —', hint, err);
    }
  }
}

/**
 * Ensures anonymous IDs exist locally — remote sync happens via `syncProfileRemote`.
 * If Supabase auth is enabled, reconcile this flow with Supabase session persistence (see services/supabase.ts).
 */
export async function bootstrapIdentity() {
  const { sessionId } = await ensureDeviceIdentity();

  void linkRevenueCatUser(sessionId);

  if (bootstrapRemoteInFlight) {
    await bootstrapRemoteInFlight;
    return;
  }

  bootstrapRemoteInFlight = runBootstrapRemote().finally(() => {
    bootstrapRemoteInFlight = null;
  });
  await bootstrapRemoteInFlight;
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

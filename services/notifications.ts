/**
 * Push notification setup and scheduling for Agastya.
 *
 * Usage:
 *   - Call `requestNotificationPermission()` once after onboarding completes.
 *   - Call `registerPushTokenWithServer()` after permission is granted (native builds).
 *   - Call `scheduleDailyTaskReminder()` after tasks are set each day.
 *   - Call `scheduleEveningReflectionReminder()` when evening reflection is incomplete.
 *   - Call `cancelDailyTaskReminder()` / `cancelEveningReflectionReminder()` when done.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isApiConfigured } from '@/services/env';
import { useSessionStore } from '@/store/sessionStore';

type ExpoNotifications = typeof import('expo-notifications');

let notificationsModule: ExpoNotifications | null | undefined;
let cachedExpoPushToken: string | null | undefined;

export const NOTIFICATION_SCREENS = {
  report: '/report',
  tasks: '/(main)/tasks',
  home: '/(main)/home',
  account: '/onboarding/account',
  paywall: '/onboarding/paywall',
  compatibility: '/report/compatibility',
  palmScan: '/onboarding/palm-scan',
} as const;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Lazy-load expo-notifications — importing it in Expo Go throws on SDK 53+. */
function getNotifications(): ExpoNotifications | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (Platform.OS === 'web' || isExpoGo()) {
    notificationsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as ExpoNotifications;
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

const DAILY_REMINDER_ID = 'agastya-daily-ritual';
const EVENING_REMINDER_ID = 'agastya-evening-reflection';
const DEFAULT_HOUR = 9; // 9 AM local time
const EVENING_HOUR = 20; // 8 PM local time

/** Configure how foreground notifications are displayed. Call at app start. */
export function configureNotificationHandler(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Request permission. Returns true if granted. Safe to call multiple times. */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Resolve Expo push token for remote notifications (native builds only).
 * Returns null on web / Expo Go / denied permission / missing projectId.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (cachedExpoPushToken !== undefined) return cachedExpoPushToken;

  const Notifications = getNotifications();
  if (!Notifications) {
    cachedExpoPushToken = null;
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    cachedExpoPushToken = null;
    return null;
  }

  try {
    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) {
      if (__DEV__) console.warn('[Agastya] Expo projectId missing — cannot get push token');
      cachedExpoPushToken = null;
      return null;
    }
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    cachedExpoPushToken = result?.data ?? null;
    return cachedExpoPushToken;
  } catch (err) {
    if (__DEV__) console.warn('[Agastya] getExpoPushToken failed', err);
    cachedExpoPushToken = null;
    return null;
  }
}

/** Clear cached token (e.g. after sign-out). */
export function clearCachedPushToken(): void {
  cachedExpoPushToken = undefined;
}

async function postNotificationApi(path: string, body: Record<string, unknown>): Promise<void> {
  if (!isApiConfigured()) return;
  const { apiUrl } = await import('@/services/env');
  const snap = useSessionStore.getState();
  if (!snap.sessionId || !snap.deviceInstallId) return;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  try {
    await fetch(apiUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: snap.sessionId,
        deviceInstallId: snap.deviceInstallId,
        ...body,
      }),
    });
  } catch (err) {
    if (__DEV__) console.warn(`[Agastya] ${path} failed`, err);
  }
}

/** Register current Expo push token with the backend. */
export async function registerPushTokenWithServer(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  await postNotificationApi('/v1/notifications/register-token', {
    expoPushToken: token,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : undefined,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  });
}

/** Disable token(s) on the server (sign-out / delete account). */
export async function unregisterPushTokenWithServer(): Promise<void> {
  const token = cachedExpoPushToken ?? (await getExpoPushToken().catch(() => null));
  await postNotificationApi('/v1/notifications/unregister-token', {
    expoPushToken: token || undefined,
  });
  clearCachedPushToken();
}

/** Update last_seen_at for cron re-engagement. */
export async function heartbeatPushToken(): Promise<void> {
  const token = cachedExpoPushToken ?? null;
  await postNotificationApi('/v1/notifications/heartbeat', {
    expoPushToken: token || undefined,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  });
}

/** Ask backend to send a named remote push event (best-effort). */
export async function notifyPushEvent(
  event: string,
  eventKey?: string,
): Promise<void> {
  const token = (await getExpoPushToken()) || undefined;
  await postNotificationApi('/v1/notifications/event', {
    event,
    eventKey,
    expoPushToken: token,
  });
}

/**
 * Schedule a daily ritual reminder at `hour:minute` in the device's local time.
 * Cancels any existing reminder with the same ID first.
 */
export async function scheduleDailyTaskReminder(
  hour = DEFAULT_HOUR,
  minute = 0,
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelDailyTaskReminder();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: 'Your daily tasks',
        body: 'You have tasks waiting for today. Tap to open them.',
        data: { screen: NOTIFICATION_SCREENS.tasks },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[Agastya] daily reminder skipped', err);
  }
}

/** Cancel the standing daily reminder (e.g. after all tasks are completed). */
export async function cancelDailyTaskReminder(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}

/** Schedule ~8pm local reminder when evening reflection is incomplete. */
export async function scheduleEveningReflectionReminder(
  hour = EVENING_HOUR,
  minute = 0,
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelEveningReflectionReminder();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_REMINDER_ID,
      content: {
        title: 'Evening reflection',
        body: 'Take a moment to reflect on today.',
        data: { screen: NOTIFICATION_SCREENS.tasks },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[Agastya] evening reminder skipped', err);
  }
}

export async function cancelEveningReflectionReminder(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(EVENING_REMINDER_ID).catch(() => {});
}

/** Schedule a one-time "your reading is ready" notification for ~3 seconds from now. */
export async function scheduleReadyNotification(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your palm reading is ready',
        body: 'Tap to open your report.',
        data: { screen: NOTIFICATION_SCREENS.report },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[Agastya] ready notification skipped', err);
  }
}

/**
 * Navigate to the screen embedded in a notification's data when the app is
 * opened from a tapped notification. Wire this into the root layout's useEffect.
 */
export function getNotificationDeepLink(
  response: import('expo-notifications').NotificationResponse,
): string | null {
  const screen = response.notification.request.content.data?.screen;
  return typeof screen === 'string' ? screen : null;
}

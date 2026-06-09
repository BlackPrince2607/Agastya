/**
 * Push notification setup and scheduling for Agastya.
 *
 * Usage:
 *   - Call `requestNotificationPermission()` once after onboarding completes.
 *   - Call `scheduleDailyTaskReminder()` after tasks are set each day.
 *   - Call `cancelDailyTaskReminder()` if the user completes all tasks early.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

let Notifications: typeof import('expo-notifications') | null = null;

function notificationsSupported(): boolean {
  if (!Notifications || Platform.OS === 'web') return false;
  // Push/local scheduling is limited in Expo Go (SDK 53+); skip to avoid runtime errors.
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const DAILY_REMINDER_ID = 'agastya-daily-ritual';
const DEFAULT_HOUR = 9; // 9 AM local time

/** Configure how foreground notifications are displayed. Call at app start. */
export function configureNotificationHandler(): void {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Request permission. Returns true if granted. Safe to call multiple times. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a daily ritual reminder at `hour:minute` in the device's local time.
 * Cancels any existing reminder with the same ID first.
 */
export async function scheduleDailyTaskReminder(
  hour = DEFAULT_HOUR,
  minute = 0,
): Promise<void> {
  if (!notificationsSupported()) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelDailyTaskReminder();

  try {
    await Notifications!.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: 'Your daily rituals await ✦',
        body: 'Take a moment to align your energy with your cosmic path.',
        data: { screen: '/tasks' },
      },
      trigger: {
        type: Notifications!.SchedulableTriggerInputTypes.DAILY,
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
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}

/** Schedule a one-time "your reading is ready" notification for ~3 seconds from now. */
export async function scheduleReadyNotification(): Promise<void> {
  if (!notificationsSupported()) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    await Notifications!.scheduleNotificationAsync({
      content: {
        title: 'Your palm reading is ready ✦',
        body: 'Agastya has finished reading your life path. Tap to explore.',
        data: { screen: '/report' },
      },
      trigger: {
        type: Notifications!.SchedulableTriggerInputTypes.TIME_INTERVAL,
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

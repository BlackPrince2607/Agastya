/**
 * Sentry crash and error tracking — initialised once at app start.
 *
 * The DSN is safe to ship in the client bundle (it only allows event ingestion).
 * Set EXPO_PUBLIC_SENTRY_DSN in your .env or EAS Secrets to enable.
 */

import { Platform } from 'react-native';

let Sentry: typeof import('@sentry/react-native') | null = null;
let Updates: { runtimeVersion?: string | null; updateId?: string | null } | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/react-native');
} catch {
  Sentry = null;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

export function initSentry(): void {
  if (!Sentry || !DSN) return;

  try {
    const integrations =
      Platform.OS === 'web' || typeof Sentry.mobileReplayIntegration !== 'function'
        ? []
        : [
            Sentry.mobileReplayIntegration({
              maskAllText: true,
              maskAllImages: true,
            }),
          ];

    Sentry.init({
      dsn: DSN,
      environment: __DEV__ ? 'development' : 'production',
      release: Updates?.runtimeVersion ?? undefined,
      dist: Updates?.updateId ?? undefined,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      replaysSessionSampleRate: Platform.OS === 'web' ? 0 : 0.05,
      replaysOnErrorSampleRate: Platform.OS === 'web' ? 0 : 1.0,
      integrations,
      beforeSend(event) {
        if (!__DEV__ && event.breadcrumbs) {
          delete event.breadcrumbs;
        }
        return event;
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[Sentry] init skipped', err);
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!Sentry || !DSN) {
    if (__DEV__) console.error('[Sentry]', err, context);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!Sentry || !DSN) return;
  Sentry.captureMessage(message, level);
}

export function setSentryUser(id: string | null): void {
  if (!Sentry || !DSN) return;
  if (id) {
    Sentry.setUser({ id });
  } else {
    Sentry.setUser(null);
  }
}

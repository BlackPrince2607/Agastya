import { Platform } from 'react-native';

import { useSessionStore } from '@/store/sessionStore';

type Props = Record<string, unknown>;

const MIXPANEL = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN?.trim();

/** Canonical product analytics events (snake_case). Display aliases in analytics map. */
export const AnalyticsEvent = {
  // App / lifecycle
  APP_OPENED: 'app_opened',

  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PALM_SCAN_STARTED: 'palm_scan_started',
  PALM_SCAN_COMPLETED: 'palm_scan_completed',
  ANALYSIS_COMPLETED: 'analysis_completed',

  // Reports
  REPORT_PREVIEW_VIEWED: 'report_preview_viewed',
  REPORT_GENERATED: 'report_generated',
  REPORT_SHARED: 'report_shared',

  // Home
  TODAYS_GUIDANCE_VIEWED: 'todays_guidance_viewed',
  GUIDANCE_REFRESHED: 'guidance_refreshed',

  // Daily engagement
  DAILY_RITUAL_VIEWED: 'daily_ritual_viewed',
  DAILY_RITUAL_COMPLETED: 'daily_ritual_completed',
  ALL_RITUALS_COMPLETED: 'all_rituals_completed',

  // Reflection
  REFLECTION_SUBMITTED: 'reflection_submitted',

  // Chat
  CHAT_STARTED: 'chat_started',
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_SESSION_ENDED: 'chat_session_ended',
  MEMORY_EXTRACTED: 'memory_extracted',

  // Weekly
  WEEKLY_SUMMARY_VIEWED: 'weekly_summary_viewed',

  // Premium
  PAYWALL_VIEWED: 'paywall_viewed',
  CHECKOUT_STARTED: 'checkout_started',
  SUBSCRIPTION_PURCHASED: 'subscription_purchased',
  SUBSCRIPTION_RESTORED: 'subscription_restored',

  // Backwards-compat aliases (keep existing call sites working)
  RITUAL_COMPLETED: 'daily_ritual_completed',
  PURCHASE_STARTED: 'checkout_started',
  PURCHASE_COMPLETED: 'subscription_purchased',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** In-memory dedupe — survives remounts within the same JS runtime. */
const firedOnce = new Set<string>();

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function utf8ToBase64(input: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(unescape(encodeURIComponent(input)));
  }
  throw new Error('btoa unavailable');
}

function withCoreProps(props: Props | undefined): Props {
  const sessionId = useSessionStore.getState().sessionId;
  return {
    ...props,
    has_session: Boolean(sessionId),
  };
}

function sanitizeFirebaseProps(props: Props): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    // Firebase RN expects scalar params; stringify any complex values for safety.
    out[key] = String(value);
  }
  return out;
}

function distinctId(): string {
  return useSessionStore.getState().sessionId ?? useSessionStore.getState().deviceInstallId ?? 'anon';
}

async function sendMixpanel(event: string, props: Props) {
  if (!MIXPANEL) return;
  let payload: string;
  try {
    payload = utf8ToBase64(
      JSON.stringify([
        {
          event,
          properties: {
            token: MIXPANEL,
            distinct_id:
              useSessionStore.getState().sessionId ?? useSessionStore.getState().deviceInstallId ?? 'anon',
            time: Math.floor(Date.now() / 1000),
            ...props,
          },
        },
      ]),
    );
  } catch {
    return;
  }
  const url = `https://api.mixpanel.com/track?data=${encodeURIComponent(payload)}`;
  await fetch(url, { method: 'GET' }).catch(() => {});
}

// Lazy-load React Native Firebase (avoids web/native mismatches).
let firebaseAnalytics: null | (() => { logEvent: Function; setUserId?: Function }) = null;
let firebaseUserId: string | null = null;

function getFirebaseAnalytics() {
  if (Platform.OS === 'web') return null;
  if (firebaseAnalytics) return firebaseAnalytics;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    firebaseAnalytics = require('@react-native-firebase/analytics').default ?? require('@react-native-firebase/analytics');
    return firebaseAnalytics;
  } catch {
    return null;
  }
}

async function sendFirebase(event: string, props: Props) {
  const analytics = getFirebaseAnalytics();
  if (!analytics) return;

  const did = distinctId();
  try {
    const maybeSetUserId = typeof analytics().setUserId === 'function' ? analytics().setUserId : undefined;
    if (firebaseUserId !== did && maybeSetUserId) {
      maybeSetUserId(did);
      firebaseUserId = did;
    }
    await analytics().logEvent(event, sanitizeFirebaseProps(props));
  } catch {
    /* best-effort */
  }
}

/** Firebase (primary) with optional Mixpanel fallback. */
export function track(event: string, props?: Props) {
  const merged = withCoreProps(props);
  if (__DEV__) {
    console.log(`[analytics] ${event}`, merged);
  }

  void sendFirebase(event, merged);
  if (MIXPANEL) {
    void sendMixpanel(event, merged);
  }
}

/** Fire at most once for `key` in this JS runtime (avoids StrictMode / remount duplicates). */
export function trackOnce(key: string, event: string, props?: Props) {
  if (firedOnce.has(key)) return;
  firedOnce.add(key);
  track(event, props);
}

/** Fire at most once per UTC calendar day for this event. */
export function trackOncePerDay(event: string, props?: Props) {
  trackOnce(`${event}:${utcDayKey()}`, event, props);
}

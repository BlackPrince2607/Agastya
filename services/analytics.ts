import { useSessionStore } from '@/store/sessionStore';

type Props = Record<string, unknown>;

const MIXPANEL = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN?.trim();
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(
  /\/$/,
  '',
);

/** Canonical product analytics events (snake_case). Display aliases in analytics map. */
export const AnalyticsEvent = {
  // Onboarding
  PALM_SCAN_STARTED: 'palm_scan_started',
  PALM_SCAN_COMPLETED: 'palm_scan_completed',
  REPORT_GENERATED: 'report_generated',
  // Home
  TODAYS_GUIDANCE_VIEWED: 'todays_guidance_viewed',
  GUIDANCE_REFRESHED: 'guidance_refreshed',
  // Tasks
  RITUAL_COMPLETED: 'ritual_completed',
  ALL_RITUALS_COMPLETED: 'all_rituals_completed',
  // Reflection
  REFLECTION_SUBMITTED: 'reflection_submitted',
  // Chat
  CHAT_STARTED: 'chat_started',
  MEMORY_EXTRACTED: 'memory_extracted',
  // Weekly
  WEEKLY_SUMMARY_VIEWED: 'weekly_summary_viewed',
  // Premium
  PAYWALL_VIEWED: 'paywall_viewed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
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

async function sendPosthog(event: string, props: Props) {
  if (!POSTHOG_KEY) return;
  await fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      properties: props,
      distinct_id: useSessionStore.getState().sessionId ?? useSessionStore.getState().deviceInstallId ?? 'anon',
    }),
  }).catch(() => {});
}

/** Mixpanel (GET /track) or PostHog capture — minimal identifiers only (no message/image payloads). */
export function track(event: string, props?: Props) {
  const merged = withCoreProps(props);
  if (__DEV__) {
    console.log(`[analytics] ${event}`, merged);
  }
  if (POSTHOG_KEY) {
    void sendPosthog(event, merged);
  } else if (MIXPANEL) {
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

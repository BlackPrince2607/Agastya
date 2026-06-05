import { useSessionStore } from '@/store/sessionStore';

type Props = Record<string, unknown>;

const MIXPANEL = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN?.trim();
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(/\/$/, '');

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

/** Mixpanel (GET /track) or PostHog capture — minimal identifiers in props (scan→report funnel). */
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

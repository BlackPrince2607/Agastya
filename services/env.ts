/**
 * API base URL resolution for Agastya backend.
 *
 * Web / simulators: EXPO_PUBLIC_AGASTYA_API_URL=http://localhost:8000
 * Physical device: auto LAN IP from app.config.js (or EXPO_PUBLIC_AGASTYA_API_LAN_URL).
 * Metro tunnel only proxies JS — FastAPI stays on your PC LAN IP port 8000.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function trimSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

const fallbackDev =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://localhost:8000';

function isPrivateLanHost(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (host.endsWith('.exp.direct') || host.includes('ngrok')) return false;
  return (
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** Metro LAN host only — ignore Expo tunnel hostnames (*.exp.direct). */
function devApiFromMetroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host || !isPrivateLanHost(host)) return null;
  return `http://${host}:8000`;
}

function resolveNativeDevApi(): string | null {
  const extra = Constants.expoConfig?.extra as { agastyaApiLanUrl?: string } | undefined;
  const fromConfig = extra?.agastyaApiLanUrl?.trim();
  if (fromConfig) return trimSlash(fromConfig);
  return devApiFromMetroHost();
}

function isLocalDevUrl(url: string): boolean {
  return (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('10.0.2.2')
  );
}

function resolveApiRoot(): string {
  const extra = Constants.expoConfig?.extra as {
    agastyaApiUrl?: string;
    agastyaApiLanUrl?: string;
  } | undefined;
  const fromExtra = extra?.agastyaApiUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_AGASTYA_API_URL?.trim();
  const configured = fromExtra || fromEnv;

  if (configured) {
    const root = trimSlash(configured);
    if (__DEV__ && Platform.OS !== 'web' && isLocalDevUrl(root)) {
      const nativeDev = resolveNativeDevApi();
      if (nativeDev) {
        console.log(`[Agastya API] ${nativeDev} (device — ${root} is only reachable on this PC)`);
        return nativeDev;
      }
      if (Platform.OS === 'android') {
        console.warn(
          '[Agastya API] Using 10.0.2.2:8000 (Android emulator). On a physical phone set EXPO_PUBLIC_AGASTYA_API_LAN_URL=http://YOUR_PC_IP:8000',
        );
        return trimSlash(fallbackDev);
      }
    }
    return root;
  }

  if (__DEV__) {
    if (Platform.OS !== 'web') {
      const nativeDev = resolveNativeDevApi();
      if (nativeDev) {
        console.log(`[Agastya API] ${nativeDev}`);
        return nativeDev;
      }
    }
    const root = trimSlash(fallbackDev);
    console.log(`[Agastya API] ${root}`);
    return root;
  }

  if (Platform.OS === 'web') {
    if (!__DEV__) {
      console.warn('[Agastya API] EXPO_PUBLIC_AGASTYA_API_URL not set — API calls disabled on web.');
    }
    return '';
  }

  return trimSlash(fallbackDev);
}

export const AGASTYA_API_ROOT = resolveApiRoot();

export function isApiConfigured(): boolean {
  return AGASTYA_API_ROOT.length > 0;
}

export function apiUrl(path: string) {
  if (!AGASTYA_API_ROOT) {
    throw new Error('EXPO_PUBLIC_AGASTYA_API_URL is not configured');
  }
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${AGASTYA_API_ROOT}${p}`;
}

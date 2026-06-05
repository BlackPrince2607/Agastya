/**
 * API base URL resolution for Agastya backend.
 *
 * Physical device + Expo Go: set EXPO_PUBLIC_AGASTYA_API_URL=http://YOUR_LAN_IP:8000
 * or rely on dev auto-detect from Metro's host (same Wi‑Fi as your PC).
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

/** e.g. hostUri "192.168.1.5:8081" → LAN IP for FastAPI on the dev machine */
function devApiFromMetroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return `http://${host}:8000`;
}

function resolveApiRoot(): string {
  const extra = Constants.expoConfig?.extra as { agastyaApiUrl?: string } | undefined;
  const fromExtra = extra?.agastyaApiUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_AGASTYA_API_URL?.trim();

  if (fromExtra) return trimSlash(fromExtra);
  if (fromEnv) {
    const root = trimSlash(fromEnv);
    if (__DEV__ && (fromEnv.includes('localhost') || fromEnv.includes('127.0.0.1'))) {
      const lan = devApiFromMetroHost();
      if (lan) {
        console.log(`[Agastya API] ${lan} (device — localhost in .env points at the phone)`);
        return lan;
      }
    }
    return root;
  }

  if (__DEV__) {
    const lan = devApiFromMetroHost();
    if (lan) {
      console.log(`[Agastya API] ${lan}`);
      return lan;
    }
  }

  const root = trimSlash(fallbackDev);
  if (__DEV__) {
    console.log(`[Agastya API] ${root}`);
  }
  return root;
}

export const AGASTYA_API_ROOT = resolveApiRoot();

export function apiUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${AGASTYA_API_ROOT}${p}`;
}

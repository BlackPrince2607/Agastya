/**
 * Meta (Facebook) App Events — ads measurement only.
 * Requires EAS native build with EXPO_PUBLIC_FACEBOOK_APP_ID + CLIENT_TOKEN.
 * No-op on web, Expo Go, or when credentials are missing.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type MetaSettings = {
  initializeSDK: () => void;
  setAdvertiserTrackingEnabled: (enabled: boolean) => Promise<boolean>;
};

let initPromise: Promise<void> | null = null;

function isMetaAdsEnabled(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.appOwnership === 'expo') return false;
  const extra = Constants.expoConfig?.extra as { metaAdsEnabled?: boolean } | undefined;
  if (extra?.metaAdsEnabled === true) return true;
  const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim();
  const token = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN?.trim();
  return Boolean(appId && token);
}

function getSettings(): MetaSettings | null {
  if (!isMetaAdsEnabled()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-fbsdk-next');
    const settings = (mod.Settings ?? mod.default?.Settings) as MetaSettings | undefined;
    return settings ?? null;
  } catch {
    return null;
  }
}

/**
 * Request iOS ATT (if needed), then initialize Meta SDK.
 * Safe to call multiple times — runs once per JS runtime.
 */
export function initMetaAds(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!isMetaAdsEnabled()) return;

    const Settings = getSettings();
    if (!Settings) return;

    try {
      if (Platform.OS === 'ios') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
          const { status } = await requestTrackingPermissionsAsync();
          if (typeof Settings.setAdvertiserTrackingEnabled === 'function') {
            await Settings.setAdvertiserTrackingEnabled(status === 'granted');
          }
        } catch {
          /* ATT unavailable — continue without IDFA */
        }
      }

      if (typeof Settings.initializeSDK === 'function') {
        Settings.initializeSDK();
      }
    } catch {
      /* best-effort */
    }
  })();
  return initPromise;
}

export function isMetaAdsAvailable(): boolean {
  return isMetaAdsEnabled() && getSettings() !== null;
}

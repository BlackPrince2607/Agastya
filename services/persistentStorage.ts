import { Platform } from 'react-native';

/** True in Expo Router static render / Node (no DOM). */
export function isServerEnvironment(): boolean {
  return typeof window === 'undefined';
}

function isWebClient(): boolean {
  return !isServerEnvironment() && (Platform.OS === 'web' || process.env.EXPO_OS === 'web');
}

const noopStorage = {
  getItem: async (_key: string): Promise<string | null> => null,
  setItem: async (_key: string, _value: string): Promise<void> => undefined,
  removeItem: async (_key: string): Promise<void> => undefined,
};

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode / quota */
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function resolvePersistentStorage() {
  if (isServerEnvironment()) return noopStorage;
  if (isWebClient()) return webStorage;
  // Native only — lazy require so web SSR bundle never loads AsyncStorage's web backend.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
}

/**
 * Cross-platform key/value storage for Zustand persist and Supabase auth.
 * Uses noop storage during static SSR so auth never touches `window` in Node.
 */
export const persistentStorage = resolvePersistentStorage();

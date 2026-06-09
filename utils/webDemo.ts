import { Platform } from 'react-native';

/** Production web demos on Vercel — set EXPO_PUBLIC_WEB_DEMO=true in Vercel env. */
export function isWebDemoMode(): boolean {
  return Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_DEMO === 'true';
}

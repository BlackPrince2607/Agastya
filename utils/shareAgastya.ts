import { Platform, Share } from 'react-native';

export const AGASTYA_SHARE_URL = 'https://agastya.app';

export const AGASTYA_SHARE_MESSAGE = `🌿 Discover Agastya

Explore your Life Blueprint with AI-powered palm insights, daily rituals, and personalized guidance.

${AGASTYA_SHARE_URL}`;

/**
 * Opens the native share sheet with Agastya invite copy.
 * Safe to call from UI — dismissals and unsupported platforms are ignored.
 */
export async function shareAgastya(): Promise<void> {
  try {
    await Share.share(
      Platform.OS === 'android'
        ? { message: AGASTYA_SHARE_MESSAGE, title: 'Discover Agastya' }
        : { message: AGASTYA_SHARE_MESSAGE },
    );
  } catch {
    /* user dismissed sheet or share unavailable */
  }
}

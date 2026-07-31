import { Platform, Share } from 'react-native';

export const AGASTYA_SHARE_URL = 'https://agastya.app';

export const AGASTYA_SHARE_MESSAGE = `🔮 I just scanned my palm and got my personalized future prediction! 😲
Curious what your palm says about your love life, career, money & destiny?
Try it here: ${AGASTYA_SHARE_URL}`;

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

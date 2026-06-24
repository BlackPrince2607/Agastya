import { Platform } from 'react-native';

import { pickPalmImageNative } from '@/utils/pickPalmImageNative';
import { pickPalmImageWeb } from '@/utils/pickPalmImageWeb';

/** Platform-aware palm photo picker → raw base64 (no data-URL prefix). */
export async function pickPalmImage(): Promise<string | null> {
  if (Platform.OS === 'web') return pickPalmImageWeb();
  return pickPalmImageNative();
}

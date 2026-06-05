import * as Haptics from 'expo-haptics';

export async function triggerLightTap() {
  try {
    await Haptics.selectionAsync();
  } catch {
    /* optional on simulator / unsupported */
  }
}

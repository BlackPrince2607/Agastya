import * as Haptics from 'expo-haptics';

export async function triggerLightTap() {
  try {
    await Haptics.selectionAsync();
  } catch {
    /* optional on simulator / unsupported */
  }
}

export async function triggerMedium() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* optional on simulator / unsupported */
  }
}

export async function triggerSuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* optional on simulator / unsupported */
  }
}

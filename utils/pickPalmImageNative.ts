import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

async function ensureLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (requested.granted) return true;

  if (!requested.canAskAgain) {
    Alert.alert(
      'Photo access needed',
      'Allow photo library access in Settings to upload a palm image.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ],
    );
  }
  return false;
}

/** Native gallery picker → base64 JPEG/PNG. */
export async function pickPalmImageNative(): Promise<string | null> {
  const allowed = await ensureLibraryPermission();
  if (!allowed) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: Platform.OS === 'ios' ? 0.65 : 0.55,
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets?.[0]?.base64) return null;
  return result.assets[0].base64;
}

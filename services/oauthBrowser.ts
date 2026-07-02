import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/** Pre-warm in-app browser for OAuth — native only (not supported on web). */
export function warmUpOAuthBrowser(): void {
  if (Platform.OS === 'web') return;
  void WebBrowser.warmUpAsync();
}

export function coolDownOAuthBrowser(): void {
  if (Platform.OS === 'web') return;
  void WebBrowser.coolDownAsync();
}

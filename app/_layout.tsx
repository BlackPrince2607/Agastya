import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import {
  NotoSerif_500Medium,
  NotoSerif_700Bold,
} from '@expo-google-fonts/noto-serif';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import '../global.css';

import { cosmicGradients } from '@/constants/theme';
import { subscribeAuthDeepLinks } from '@/services/authCallback';
import { subscribeSupabaseSessionMerge } from '@/services/authMerge';

export {
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AgastyaTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: cosmicGradients.aurora[0],
    card: cosmicGradients.aurora[1],
    text: '#e8e4ff',
    border: 'rgba(255,255,255,0.08)',
    primary: '#a78bfa',
  },
};

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    Inter_400Regular,
    Inter_500Medium,
    NotoSerif_500Medium,
    NotoSerif_700Bold,
    SpaceGrotesk_600SemiBold,
  });

  useEffect(() => {
    if (error) {
      console.warn('[Agastya] Font load failed — continuing with system fonts', error);
    }
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  /** Never leave users on the native splash if fonts hang on device. */
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stopDeepLinks = subscribeAuthDeepLinks();
    const stopMerge = subscribeSupabaseSessionMerge();
    return () => {
      stopDeepLinks();
      stopMerge();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={AgastyaTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: cosmicGradients.aurora[0] },
            animation: 'fade',
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(main)" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

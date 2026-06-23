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
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import '../global.css';

import { cosmicGradients } from '@/constants/theme';
import { subscribeAuthDeepLinks } from '@/services/authCallback';
import { applyDevAccessGrants } from '@/services/authConfig';
import { applyDevQuickAccess } from '@/services/devAccess';
import { subscribeSupabaseSessionMerge } from '@/services/authMerge';
import { bootstrapIdentity } from '@/services/identity';
import { configureRevenueCat } from '@/services/revenuecat';
import { isServerEnvironment } from '@/services/persistentStorage';
import { initSentry } from '@/services/sentry';
import { useSessionStore } from '@/store/sessionStore';
import {
  configureNotificationHandler,
  getNotificationDeepLink,
} from '@/services/notifications';

// Initialise Sentry before any other code runs
initSentry();

// Configure how foreground notifications are shown
configureNotificationHandler();

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
    text: '#e6e1e5',
    border: 'rgba(255,255,255,0.08)',
    primary: '#a855f7',
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
    if (isServerEnvironment()) return;
    applyDevAccessGrants();
    applyDevQuickAccess();
    const stopDeepLinks = subscribeAuthDeepLinks();
    const stopMerge = subscribeSupabaseSessionMerge();
    void bootstrapIdentity().then(() => {
      const id = useSessionStore.getState().sessionId;
      if (id) void configureRevenueCat(id);
    });
    return () => {
      stopDeepLinks();
      stopMerge();
    };
  }, []);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;

    let sub: ReturnType<typeof import('expo-notifications').addNotificationResponseReceivedListener> | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener(
        (response: import('expo-notifications').NotificationResponse) => {
          const link = getNotificationDeepLink(response);
          if (!link) return;
          void import('@/utils/navigationFlow').then(({ tryEnterMainApp }) => {
            import('@/store/sessionStore').then(({ useSessionStore }) => {
              if (link.startsWith('/(main)/') || link === '/tasks' || link === '/chat') {
                if (!useSessionStore.getState().hasEnteredMain) {
                  void tryEnterMainApp();
                }
              }
              import('expo-router').then(({ router }) => {
                const target = link === '/tasks' ? '/(main)/tasks' : link;
                router.push(target as never);
              });
            });
          });
        },
      );
    } catch {
      // expo-notifications not available on web
    }
    return () => sub?.remove();
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
          <Stack.Screen name="auth/callback" options={{ animation: 'fade' }} />
          <Stack.Screen name="auth/reset-password" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(main)" />
          <Stack.Screen name="report" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="task/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

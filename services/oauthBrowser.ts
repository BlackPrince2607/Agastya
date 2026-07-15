import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const CHROME_PACKAGES = ['com.android.chrome', 'com.chrome.beta', 'com.chrome.dev'];

/** Browsers that often fail to complete OAuth redirects back to the app. */
const BLOCKED_ANDROID_BROWSERS = new Set([
  'com.sec.android.app.sbrowser',
  'com.sec.android.app.sbrowser.beta',
  'com.opera.browser',
  'com.opera.mini.native',
  'com.brave.browser',
]);

let cachedBrowserPackage: string | undefined | null = null;
let cachedBrowserWarning: string | null | undefined;

async function resolveAuthBrowserPackage(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  if (cachedBrowserPackage !== null) {
    return cachedBrowserPackage || undefined;
  }

  try {
    const info = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
    const packages = info.browserPackages ?? [];

    const chrome = packages.find((pkg) => CHROME_PACKAGES.includes(pkg));
    if (chrome) {
      cachedBrowserPackage = chrome;
      if (__DEV__) {
        console.log('[Agastya auth] OAuth browser → Chrome Custom Tabs');
      }
      return chrome;
    }

    const safe = packages.filter((pkg) => !BLOCKED_ANDROID_BROWSERS.has(pkg));
    const picked =
      safe[0] ??
      (info.preferredBrowserPackage && !BLOCKED_ANDROID_BROWSERS.has(info.preferredBrowserPackage)
        ? info.preferredBrowserPackage
        : undefined) ??
      (info.defaultBrowserPackage && !BLOCKED_ANDROID_BROWSERS.has(info.defaultBrowserPackage)
        ? info.defaultBrowserPackage
        : undefined) ??
      '';

    cachedBrowserPackage = picked;
    if (__DEV__ && picked) {
      console.log('[Agastya auth] OAuth browser package:', picked);
    }
  } catch {
    cachedBrowserPackage = '';
  }

  return cachedBrowserPackage || undefined;
}

/** Warn when only Samsung Internet (or no Custom Tabs browser) is available. */
export async function getOAuthBrowserWarning(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  if (cachedBrowserWarning !== undefined) {
    return cachedBrowserWarning;
  }

  try {
    const info = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
    const packages = info.browserPackages ?? [];
    const hasChrome = packages.some((pkg) => CHROME_PACKAGES.includes(pkg));
    if (hasChrome) {
      cachedBrowserWarning = null;
      return null;
    }

    const onlySamsung =
      packages.length > 0 && packages.every((pkg) => BLOCKED_ANDROID_BROWSERS.has(pkg));
    if (onlySamsung || info.defaultBrowserPackage?.includes('sbrowser')) {
      cachedBrowserWarning =
        'Samsung Internet often cannot finish Google sign-in. Install Google Chrome, set it as your default browser, then try again.';
      return cachedBrowserWarning;
    }

    if (packages.length === 0) {
      cachedBrowserWarning =
        'Install Google Chrome for sign-in. Expo Go needs Chrome Custom Tabs to return from Google.';
      return cachedBrowserWarning;
    }
  } catch {
    /* ignore */
  }

  cachedBrowserWarning = null;
  return null;
}

/** Pre-warm Chrome Custom Tabs for OAuth — native only. */
export async function warmUpOAuthBrowser(): Promise<void> {
  if (Platform.OS === 'web') return;
  const browserPackage = await resolveAuthBrowserPackage();
  await WebBrowser.warmUpAsync(browserPackage);
}

export function coolDownOAuthBrowser(): void {
  if (Platform.OS === 'web') return;
  void WebBrowser.coolDownAsync();
}

/**
 * Open OAuth in Chrome Custom Tabs.
 * On Expo Go the redirect is `exp://<metro>/--/auth/callback` so Custom Tabs hand off to the app.
 */
export async function openOAuthBrowserSession(oauthUrl: string, redirectUri: string) {
  const browserPackage = await resolveAuthBrowserPackage();
  if (browserPackage) {
    await WebBrowser.mayInitWithUrlAsync(oauthUrl, browserPackage).catch(() => {});
  }

  return WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri, {
    showTitle: false,
    enableDefaultShareMenuItem: false,
    createTask: false,
    ...(browserPackage ? { browserPackage } : {}),
  });
}

/** Best-effort close of Custom Tabs / SFSafariViewController (Expo Go may return undefined). */
export async function dismissOAuthBrowser(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dismiss = WebBrowser.dismissBrowser;
    if (typeof dismiss !== 'function') return;
    const result = dismiss();
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      await (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function resetOAuthBrowserCache(): void {
  cachedBrowserPackage = null;
  cachedBrowserWarning = undefined;
}

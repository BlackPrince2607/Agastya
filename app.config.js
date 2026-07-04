/**
 * Expo config — merges static app.json with runtime extras from env.
 *
 * EXPO_PUBLIC_AGASTYA_API_URL: backend root for all platforms; required for production web/export
 * builds pointing at a hosted API. Dev: optional — services/env.ts falls back to localhost
 * simulators or set LAN IP for physical devices. Do not put secrets here.
 */
const appJson = require('./app.json');

const easProjectId = appJson.expo.extra?.eas?.projectId ?? '';
const updatesConfigured =
  Boolean(easProjectId) && !String(easProjectId).includes('REPLACE_WITH');

/** Dev machine LAN IP for physical phones (Metro tunnel does not expose port 8000). */
function getDevLanApiUrl() {
  const explicit = process.env.EXPO_PUBLIC_AGASTYA_API_LAN_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const api = process.env.EXPO_PUBLIC_AGASTYA_API_URL?.trim() ?? '';
  if (!api.includes('localhost') && !api.includes('127.0.0.1')) return undefined;

  const os = require('os');
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const net of iface) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const { address } = net;
      if (
        address.startsWith('192.168.') ||
        address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(address)
      ) {
        return `http://${address}:8000`;
      }
    }
  }
  return undefined;
}

const basePlugins = appJson.expo.plugins ?? [];
const hasSentryNativePlugin = basePlugins.some(
  (entry) =>
    entry === '@sentry/react-native' ||
    (Array.isArray(entry) && entry[0] === '@sentry/react-native'),
);
const plugins = hasSentryNativePlugin ? basePlugins : [...basePlugins, '@sentry/react-native'];

const DEFAULT_PRODUCTION_API = 'https://agastya-production-397b.up.railway.app';
const isEasBuild = process.env.EAS_BUILD === 'true' || process.env.CI === 'true';

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...(appJson.expo.extra ?? {}),
      agastyaApiUrl:
        process.env.EXPO_PUBLIC_AGASTYA_API_URL?.trim() ||
        (isEasBuild ? DEFAULT_PRODUCTION_API : undefined),
      agastyaApiLanUrl: getDevLanApiUrl(),
    },
    // Disable OTA updates until EAS project ID is configured — avoids dev/build errors.
    updates: updatesConfigured ? appJson.expo.updates : { enabled: false },
  },
};

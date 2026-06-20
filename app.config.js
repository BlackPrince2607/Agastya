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

const truthy = (v) => v === true || v === 'true';

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      agastyaApiUrl: process.env.EXPO_PUBLIC_AGASTYA_API_URL || undefined,
      bypassAuth: truthy(process.env.EXPO_PUBLIC_BYPASS_AUTH),
      allowDevPremium: truthy(process.env.EXPO_PUBLIC_ALLOW_DEV_PREMIUM),
    },
    // Disable OTA updates until EAS project ID is configured — avoids dev/build errors.
    updates: updatesConfigured ? appJson.expo.updates : { enabled: false },
  },
};

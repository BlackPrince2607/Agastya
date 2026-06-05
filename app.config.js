/**
 * Expo config — merges static app.json with runtime extras from env.
 *
 * EXPO_PUBLIC_AGASTYA_API_URL: backend root for all platforms; required for production web/export
 * builds pointing at a hosted API. Dev: optional — services/env.ts falls back to localhost
 * simulators or set LAN IP for physical devices. Do not put secrets here.
 */
const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      agastyaApiUrl: process.env.EXPO_PUBLIC_AGASTYA_API_URL || undefined,
    },
  },
};

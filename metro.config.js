const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * Metro + tslib 2.8 `exports` map can resolve the ESM build where interop
 * leaves `default` undefined → "Cannot destructure property '__extends' of 'tslib.default'".
 * Pin resolution to the classic CommonJS entry used across RN deps.
 */
const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/tslib/tslib.js'),
      type: 'sourceFile',
    };
  }
  // Zustand ESM uses import.meta — prefer CJS entry on web export.
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    return {
      filePath: require.resolve(moduleName),
      type: 'sourceFile',
    };
  }
  if (typeof origResolveRequest === 'function') {
    return origResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });

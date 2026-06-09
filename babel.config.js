module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          // Zustand (and other ESM deps) emit import.meta — invalid in Expo web bundles.
          unstable_transformImportMeta: true,
        },
      ],
      'nativewind/babel',
    ],
  };
};

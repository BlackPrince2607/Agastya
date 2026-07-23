const { createRunOncePlugin } = require('expo/config-plugins');

/**
 * Local config plugin — ensures the play-user-choice Android module is
 * included on prebuild. Autolinking via package.json dependency usually
 * suffices; this documents the enrollment requirement.
 */
const withPlayUserChoice = (config) => config;

module.exports = createRunOncePlugin(withPlayUserChoice, 'play-user-choice', '1.0.0');

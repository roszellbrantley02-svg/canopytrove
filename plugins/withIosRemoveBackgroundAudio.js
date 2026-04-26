const { createRunOncePlugin, withInfoPlist } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-ios-remove-background-audio';
const PLUGIN_VERSION = '1.0.0';

const withIosRemoveBackgroundAudio = (config) =>
  withInfoPlist(config, (config) => {
    const existingModes = Array.isArray(config.modResults.UIBackgroundModes)
      ? config.modResults.UIBackgroundModes
      : [];
    const filteredModes = existingModes.filter((mode) => mode !== 'audio');

    if (filteredModes.length > 0) {
      config.modResults.UIBackgroundModes = filteredModes;
    } else {
      delete config.modResults.UIBackgroundModes;
    }

    return config;
  });

module.exports = createRunOncePlugin(
  withIosRemoveBackgroundAudio,
  PLUGIN_NAME,
  PLUGIN_VERSION,
);

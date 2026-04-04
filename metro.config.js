const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Inline requires: critical for Hermes performance — lazy-loads modules on first use
config.transformer = {
  ...config.transformer,
  inlineRequires: true,
};

module.exports = config;

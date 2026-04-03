const appJson = require('./app.json');

function hasPlugin(plugins, pluginName) {
  return plugins.some((plugin) => {
    if (typeof plugin === 'string') {
      return plugin === pluginName;
    }

    return Array.isArray(plugin) && plugin[0] === pluginName;
  });
}

module.exports = ({ config }) => {
  const baseConfig = {
    ...(config ?? {}),
    ...appJson.expo,
  };

  const plugins = [...(baseConfig.plugins ?? [])];
  const sentryOrganization = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();

  if (sentryOrganization && sentryProject && !hasPlugin(plugins, '@sentry/react-native/expo')) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        organization: sentryOrganization,
        project: sentryProject,
        url: process.env.SENTRY_URL?.trim() || 'https://sentry.io/',
      },
    ]);
  }

  return {
    ...baseConfig,
    plugins,
  };
};

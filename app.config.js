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

  if (!hasPlugin(plugins, 'expo-image')) {
    plugins.push('expo-image');
  }

  if (!hasPlugin(plugins, 'expo-iap')) {
    plugins.push('expo-iap');
  }

  if (!hasPlugin(plugins, './plugins/withAndroidAdiRegistration')) {
    plugins.push('./plugins/withAndroidAdiRegistration');
  }

  if (!hasPlugin(plugins, './plugins/withIosUseModularHeaders')) {
    plugins.push('./plugins/withIosUseModularHeaders');
  }

  if (!hasPlugin(plugins, './plugins/withIosRemoveBackgroundAudio')) {
    plugins.push('./plugins/withIosRemoveBackgroundAudio');
  }

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

  // EAS can double-up arrays like associatedDomains and intentFilters when it
  // merges the pre-resolved config with appJson.expo. Deduplicate defensively.
  const ios = baseConfig.ios
    ? {
        ...baseConfig.ios,
        associatedDomains: baseConfig.ios.associatedDomains
          ? [...new Set(baseConfig.ios.associatedDomains)]
          : baseConfig.ios.associatedDomains,
      }
    : baseConfig.ios;

  const android = baseConfig.android
    ? {
        ...baseConfig.android,
        intentFilters: baseConfig.android.intentFilters
          ? baseConfig.android.intentFilters.filter((item, index, arr) => {
              const key = JSON.stringify(item);
              return arr.findIndex((i) => JSON.stringify(i) === key) === index;
            })
          : baseConfig.android.intentFilters,
      }
    : baseConfig.android;

  return {
    ...baseConfig,
    ios,
    android,
    plugins,
  };
};

const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-android-adi-registration';
const PLUGIN_VERSION = '1.0.0';
const TOKEN_FILE_NAME = 'adi-registration.properties';

function resolveToken(projectRoot, props = {}) {
  const fromProps = typeof props.token === 'string' ? props.token.trim() : '';

  if (fromProps) {
    return fromProps;
  }

  const fromEnv = process.env.ANDROID_ADI_REGISTRATION_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const rootTokenFile = path.join(projectRoot, TOKEN_FILE_NAME);
  if (fs.existsSync(rootTokenFile)) {
    return fs.readFileSync(rootTokenFile, 'utf8').trim();
  }

  return '';
}

const withAndroidAdiRegistration = (config, props = {}) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const token = resolveToken(config.modRequest.projectRoot, props);

      if (!token) {
        return config;
      }

      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
      );

      await fs.promises.mkdir(assetsDir, { recursive: true });
      await fs.promises.writeFile(path.join(assetsDir, TOKEN_FILE_NAME), `${token}\n`, 'utf8');
      return config;
    },
  ]);

module.exports = createRunOncePlugin(withAndroidAdiRegistration, PLUGIN_NAME, PLUGIN_VERSION);

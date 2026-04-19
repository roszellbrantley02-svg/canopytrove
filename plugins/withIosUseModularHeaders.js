const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'with-ios-use-modular-headers';
const PLUGIN_VERSION = '1.0.0';

// React Native Firebase (v22+) pulls in Swift pods (FirebaseCoreInternal,
// AppCheckCore) that depend on non-modular Objective-C pods such as
// GoogleUtilities. When the default Expo Podfile builds with static libraries,
// CocoaPods refuses to integrate those Swift pods unless modular headers are
// turned on. Injecting `use_modular_headers!` at the top of the Podfile fixes
// the `pod install` failure without switching the whole project to frameworks.
const MARKER = '# Canopy Trove: enable modular headers for Firebase + AppCheck';
const DIRECTIVE = `${MARKER}\nuse_modular_headers!`;

const withIosUseModularHeaders = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      const existing = await fs.promises.readFile(podfilePath, 'utf8');
      if (existing.includes(MARKER)) {
        return config;
      }

      // Insert the directive immediately after the first `require` / `platform`
      // block so it applies globally before any `target` is defined.
      const lines = existing.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (line.startsWith('target ')) {
          insertIndex = i;
          break;
        }
      }

      lines.splice(insertIndex, 0, '', DIRECTIVE, '');

      await fs.promises.writeFile(podfilePath, lines.join('\n'), 'utf8');
      return config;
    },
  ]);

module.exports = createRunOncePlugin(
  withIosUseModularHeaders,
  PLUGIN_NAME,
  PLUGIN_VERSION,
);

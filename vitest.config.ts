import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rnMockPath = resolve(__dirname, 'src/__mocks__/react-native.ts');

/**
 * Vite plugin that redirects all react-native imports to our lightweight mock.
 * This runs at the resolver level (enforce: 'pre') — before Rolldown ever
 * tries to parse the Flow-typed source in node_modules/react-native/index.js.
 */
function reactNativeMock(): Plugin {
  return {
    name: 'react-native-mock',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'react-native' || source.startsWith('react-native/')) {
        return rnMockPath;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [reactNativeMock()],
  test: {
    environment: 'node',
    include: ['App.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});

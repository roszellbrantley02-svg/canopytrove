import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactNativePlugin from 'eslint-plugin-react-native';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'node_modules/',
      'dist/',
      'web-build/',
      'build-artifacts/',
      'backend/',
      '.expo/',
      'android/',
      'ios/',
    ],
  },

  // Base TypeScript config
  ...tseslint.configs.recommended,

  // Allow CommonJS-style config files that still need require()
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // React settings
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off', // not needed with React 17+ JSX transform
      'react/prop-types': 'off', // using TypeScript for prop types
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/no-inline-styles': 'warn',
      // This app intentionally uses curated RGBA/brand literals in premium UI surfaces.
      'react-native/no-color-literals': 'off',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Test files — relax some rules
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Prettier must be last to override conflicting rules
  eslintConfigPrettier,
);

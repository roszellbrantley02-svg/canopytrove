/**
 * Global Vitest setup — polyfills and re-stubs for the Node test environment.
 *
 * 1. requestAnimationFrame / cancelAnimationFrame — not available in Node but
 *    used by MotionInView and similar animation components.
 * 2. vi.fn() wrappers on the react-native mock so per-test assertions
 *    (e.g. expect(Vibration.vibrate).toHaveBeenCalled()) get fresh spies.
 */

globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
};
globalThis.cancelAnimationFrame = () => {};

// React Native's Metro bundler injects `__DEV__` as a global at build time.
// Vitest doesn't have it, so any module that reads `__DEV__` (e.g.
// sentryMonitoringService picking 'development' vs 'production') hits a
// ReferenceError at import time. Default to false to match production
// semantics — tests should exercise the same code path the shipping
// build hits. Initial choice was `true` but that broke
// ownerPortalConfig's "allowlist empty → .com bypass" assertion because
// it treats `__DEV__` as "this is a dev build, let any email in."
(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;

// React 19's react-test-renderer uses concurrent rendering. act() must be
// available for create()/update() to flush synchronously. This flag tells React
// that the current environment supports act().
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { vi } from 'vitest';

// Metro resolves image require() calls to native asset records. In Vitest/Node,
// those same require('*.png') calls need a lightweight stand-in so native icon
// packs can be imported without trying to execute PNG bytes as JavaScript.
if (typeof require !== 'undefined' && require.extensions) {
  require.extensions['.png'] = (module, filename) => {
    module.exports = { uri: filename };
  };
}

// Mock expo-secure-store before any transitive import can reach the native binary.
// The real module tries to load ExpoSecureStore (a native C++ addon) which doesn't
// exist in the Node test environment.
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  deleteItem: vi.fn(),
  AFTER_FIRST_UNLOCK: 0,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  ALWAYS: 2,
  ALWAYS_THIS_DEVICE_ONLY: 3,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 4,
  WHEN_UNLOCKED: 5,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
}));

vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

import { Vibration, BackHandler, Alert, Keyboard } from 'react-native';

// Wrap plain functions with vi.fn() so tests can assert on call counts.
Vibration.vibrate = vi.fn();
Vibration.cancel = vi.fn();
BackHandler.exitApp = vi.fn();
BackHandler.addEventListener = vi.fn((_e: string, _h: () => boolean) => ({ remove: vi.fn() }));
Alert.alert = vi.fn();
Alert.prompt = vi.fn();
Keyboard.dismiss = vi.fn();

/**
 * Global Vitest setup — polyfills and re-stubs for the Node test environment.
 *
 * 1. requestAnimationFrame / cancelAnimationFrame — not available in Node but
 *    used by MotionInView and similar animation components.
 * 2. vi.fn() wrappers on the react-native mock so per-test assertions
 *    (e.g. expect(Vibration.vibrate).toHaveBeenCalled()) get fresh spies.
 */

globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
globalThis.cancelAnimationFrame = () => {};

// React 19's react-test-renderer uses concurrent rendering. act() must be
// available for create()/update() to flush synchronously. This flag tells React
// that the current environment supports act().
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { vi } from 'vitest';
import { Vibration, BackHandler, Alert, Keyboard } from 'react-native';

// Wrap plain functions with vi.fn() so tests can assert on call counts.
Vibration.vibrate = vi.fn();
Vibration.cancel = vi.fn();
BackHandler.exitApp = vi.fn();
BackHandler.addEventListener = vi.fn((_e: string, _h: () => boolean) => ({ remove: vi.fn() }));
Alert.alert = vi.fn();
Alert.prompt = vi.fn();
Keyboard.dismiss = vi.fn();

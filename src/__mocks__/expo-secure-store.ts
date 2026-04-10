/**
 * Lightweight expo-secure-store mock for Vitest.
 *
 * The native module (ExpoSecureStore) doesn't exist in the Node test
 * environment. This mock provides no-op implementations of the API surface
 * so transitive imports (e.g. from Firebase auth persistence) resolve
 * without crashing the test runner.
 */

export async function getItemAsync(_key: string): Promise<string | null> {
  return null;
}

export async function setItemAsync(_key: string, _value: string): Promise<void> {}

export async function deleteItemAsync(_key: string): Promise<void> {}

export function getItem(_key: string): string | null {
  return null;
}

export function setItem(_key: string, _value: string): void {}

export function deleteItem(_key: string): void {}

// Re-export enum-like constants the SDK exposes
export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const ALWAYS_THIS_DEVICE_ONLY = 3;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

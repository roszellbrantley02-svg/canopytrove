/**
 * Lightweight type shim for `expo-audio`'s `AudioSource`, kept local so the
 * manifest and player service don't need to directly import the package at
 * type-check time. `expo-audio` accepts either a local `require()` handle
 * (which resolves to a number at runtime under Metro) or a `{ uri: string }`
 * object for remote streams.
 */
export type AVPlaybackSource = number | { uri: string; headers?: Record<string, string> };
